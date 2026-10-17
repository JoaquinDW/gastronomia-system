import "server-only";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp, { type Metadata } from "sharp";
import { getPool } from "./postgres";
import { HttpError } from "./errors";

const MIN_SIDE = 600;
const MAX_IMAGES_PER_BUSINESS = 2000;

/** Normalizes a product photo: fixes orientation, strips metadata and makes two WebP sizes. */
export async function processMenuImage(input: Buffer) {
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw new HttpError(422, "No pudimos leer la foto. Usá JPG, PNG o WEBP.");
  }
  if (
    !metadata.format ||
    !["jpeg", "png", "webp"].includes(metadata.format) ||
    (metadata.pages ?? 1) > 1
  )
    throw new HttpError(422, "Usá una foto JPG, PNG o WEBP, sin animación.");
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = (rotated ? metadata.height : metadata.width) ?? 0;
  const height = (rotated ? metadata.width : metadata.height) ?? 0;
  if (Math.min(width, height) < MIN_SIDE)
    throw new HttpError(
      422,
      `La foto es muy chica (${width}×${height} px) y se vería borrosa. Subí una de al menos ${MIN_SIDE} px por lado.`,
    );
  const base = () =>
    sharp(input, { limitInputPixels: 50_000_000 })
      .rotate()
      .flatten({ background: "#ffffff" });
  const [large, small] = await Promise.all([
    base()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true }),
    base()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer(),
  ]);
  return {
    large: large.data,
    small,
    width: large.info.width,
    height: large.info.height,
  };
}

// Declared as public_read in neon.ts; `neon deploy` creates it on each branch.
export const MEDIA_BUCKET = "pedipue-media";

const storageVars = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
] as const;

/** Object Storage is used once the branch's storage credentials are in the environment. */
export function storageEnabled() {
  return storageVars.every((name) => process.env[name]);
}

const storageState = globalThis as typeof globalThis & { mediaS3?: S3Client };
function storage() {
  storageState.mediaS3 ??= new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    // Neon's storage gateway only supports path-style addressing.
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  return storageState.mediaS3;
}

const fileName = { large: "1600.webp", small: "800.webp" } as const;

/** Public URL of one size; the bucket allows anonymous reads. */
function publicUrl(key: string, size: "large" | "small") {
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 ?? "").replace(/\/+$/, "");
  return `${endpoint}/${MEDIA_BUCKET}/${key}/${fileName[size]}`;
}

/** Uploads both sizes. Keys are unique per image, so the files never change. */
export async function uploadMenuImageFiles(
  businessId: string,
  imageId: string,
  files: { large: Buffer; small: Buffer },
) {
  const key = `menu/${businessId}/${imageId}`;
  await Promise.all(
    (["large", "small"] as const).map((size) =>
      storage().send(
        new PutObjectCommand({
          Bucket: MEDIA_BUCKET,
          Key: `${key}/${fileName[size]}`,
          Body: files[size],
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
    ),
  );
  return key;
}

async function deleteMenuImageFiles(key: string) {
  await storage().send(
    new DeleteObjectsCommand({
      Bucket: MEDIA_BUCKET,
      Delete: {
        Objects: Object.values(fileName).map((name) => ({
          Key: `${key}/${name}`,
        })),
      },
    }),
  );
}

export async function saveMenuImage(
  businessId: string,
  userId: string,
  input: Buffer,
) {
  const image = await processMenuImage(input);
  const pool = getPool();
  const id = randomUUID();
  let key: string | null = null;
  if (storageEnabled()) {
    // Check the limit before uploading so a full business doesn't leave files behind.
    const { rows } = await pool.query<{ full: boolean }>(
      `SELECT count(*) >= $2 AS full FROM menu_images WHERE business_id=$1`,
      [businessId, MAX_IMAGES_PER_BUSINESS],
    );
    if (rows[0]?.full) throw limitReached();
    try {
      key = await uploadMenuImageFiles(businessId, id, image);
    } catch {
      throw new HttpError(
        503,
        "No pudimos guardar la foto. Probá de nuevo en un rato.",
      );
    }
  }
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO menu_images(id,business_id,width,height,large,small,storage_key,created_by)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8
     WHERE (SELECT count(*) FROM menu_images WHERE business_id=$2) < $9
     RETURNING id`,
    [
      id,
      businessId,
      image.width,
      image.height,
      key ? null : image.large,
      key ? null : image.small,
      key,
      userId,
      MAX_IMAGES_PER_BUSINESS,
    ],
  );
  if (!rows[0]) {
    if (key) await deleteMenuImageFiles(key).catch(() => {});
    throw limitReached();
  }
  return {
    url: `/api/media/${rows[0].id}`,
    width: image.width,
    height: image.height,
  };
}

const limitReached = () =>
  new HttpError(
    422,
    "Llegaste al límite de fotos para este negocio. Escribinos y lo ampliamos.",
  );

/** A copied photo is a public storage URL to redirect to; an older or local one is still bytes in Postgres. */
export async function readMenuImage(
  id: string,
  size: "large" | "small",
): Promise<{ url: string } | { data: Buffer } | null> {
  const { rows } = await getPool().query<{
    key: string | null;
    data: Buffer | null;
  }>(
    `SELECT storage_key AS key,
       CASE WHEN storage_key IS NULL THEN ${size === "small" ? "small" : "large"} END AS data
     FROM menu_images WHERE id=$1`,
    [id],
  );
  const row = rows[0];
  if (row?.key) return { url: publicUrl(row.key, size) };
  if (row?.data) return { data: row.data };
  return null;
}
