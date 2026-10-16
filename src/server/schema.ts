import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  boolean,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import type { Variant, AddOn, Hours, DeliveryZone } from "../lib/menu";

export const businessKind = pgEnum("business_kind", [
  "hamburgueseria",
  "rotiseria",
  "pastas",
  "otro",
]);
export const membershipRole = pgEnum("membership_role", [
  "owner",
  "manager",
  "cashier",
  "kitchen",
]);

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 63 }).notNull().unique(),
    kind: businessKind("kind").notNull(),
    whatsapp: varchar("whatsapp", { length: 16 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("ARS"),
    timezone: text("timezone").notNull().default("America/Argentina/Cordoba"),
    createdByUserId: text("created_by_user_id").notNull(),
    onboardingKey: uuid("onboarding_key").notNull(),
    onboardingHash: varchar("onboarding_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("businesses_creator_onboarding_key_unique").on(
      table.createdByUserId,
      table.onboardingKey,
    ),
    check(
      "businesses_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check(
      "businesses_whatsapp_format",
      sql`${table.whatsapp} ~ '^[+][1-9][0-9]{7,14}$'`,
    ),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 100 }).notNull().default("Casa central"),
    city: varchar("city", { length: 100 }).notNull(),
    address: varchar("address", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("locations_business_id_idx").on(table.businessId)],
);

export const memberships = pgTable(
  "memberships",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    userId: text("user_id").notNull(),
    role: membershipRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.businessId, table.userId] }),
    index("memberships_user_id_idx").on(table.userId),
  ],
);

export const menuProducts = pgTable(
  "menu_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    category: varchar("category", { length: 80 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull().default("product"),
    variants: jsonb("variants").$type<Variant[]>().notNull(),
    addOns: jsonb("add_ons").$type<AddOn[]>().notNull().default([]),
    imageUrl: text("image_url"),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("menu_products_business_idx").on(t.businessId, t.sortOrder),
    check(
      "menu_products_variants_array",
      sql`jsonb_typeof(${t.variants}) = 'array' AND jsonb_array_length(${t.variants}) > 0`,
    ),
  ],
);

export const storeSettings = pgTable("store_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id),
  description: text("description").notNull().default(""),
  menuNote: text("menu_note").notNull().default(""),
  hours: jsonb("hours").$type<Hours>().notNull().default([]),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  pickupInstructions: text("pickup_instructions").notNull().default(""),
  deliveryEnabled: boolean("delivery_enabled").notNull().default(false),
  deliveryZones: jsonb("delivery_zones")
    .$type<DeliveryZone[]>()
    .notNull()
    .default([]),
  paymentMethods: jsonb("payment_methods")
    .$type<("cash" | "transfer")[]>()
    .notNull()
    .default(["cash"]),
  transferAlias: varchar("transfer_alias", { length: 100 })
    .notNull()
    .default(""),
  isPublished: boolean("is_published").notNull().default(false),
  nextOrderNumber: integer("next_order_number").notNull().default(1),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const menuImports = pgTable(
  "menu_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    userId: text("user_id").notNull(),
    requestKey: uuid("request_key").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("processing"),
    draft: jsonb("draft"),
    model: varchar("model", { length: 80 }).notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
  },
  (t) => [
    unique("menu_imports_request_unique").on(t.businessId, t.requestKey),
    index("menu_imports_daily_idx").on(t.businessId, t.createdAt),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    number: integer("number").notNull(),
    requestKey: uuid("request_key").notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    status: varchar("status", { length: 30 })
      .notNull()
      .default("pending_confirmation"),
    customerName: varchar("customer_name", { length: 100 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 16 }).notNull(),
    fulfillment: varchar("fulfillment", { length: 20 }).notNull(),
    address: varchar("address", { length: 250 }),
    zoneName: varchar("zone_name", { length: 100 }),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
    note: varchar("note", { length: 500 }).notNull().default(""),
    items: jsonb("items").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryCents: integer("delivery_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("orders_request_unique").on(t.businessId, t.requestKey),
    unique("orders_number_unique").on(t.businessId, t.number),
    index("orders_business_date_idx").on(t.businessId, t.createdAt),
    check(
      "orders_total_valid",
      sql`${t.totalCents} = ${t.subtotalCents} + ${t.deliveryCents} AND ${t.totalCents} >= 0`,
    ),
  ],
);
