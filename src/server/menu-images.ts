import "server-only";
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

export async function saveMenuImage(
  businessId: string,
  userId: string,
  input: Buffer,
) {
  const image = await processMenuImage(input);
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO menu_images(business_id,width,height,large,small,created_by)
     SELECT $1,$2,$3,$4,$5,$6
     WHERE (SELECT count(*) FROM menu_images WHERE business_id=$1) < $7
     RETURNING id`,
    [
      businessId,
      image.width,
      image.height,
      image.large,
      image.small,
      userId,
      MAX_IMAGES_PER_BUSINESS,
    ],
  );
  if (!rows[0])
    throw new HttpError(
      422,
      "Llegaste al límite de fotos para este negocio. Escribinos y lo ampliamos.",
    );
  return {
    url: `/api/media/${rows[0].id}`,
    width: image.width,
    height: image.height,
  };
}

export async function readMenuImage(id: string, size: "large" | "small") {
  const { rows } = await getPool().query<{ data: Buffer }>(
    `SELECT ${size === "small" ? "small" : "large"} AS data FROM menu_images WHERE id=$1`,
    [id],
  );
  return rows[0]?.data ?? null;
}
