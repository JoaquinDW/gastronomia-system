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
  numeric,
  foreignKey,
  customType,
  smallint,
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
  (table) => [
    index("locations_business_id_idx").on(table.businessId),
    unique("locations_tenant_unique").on(table.businessId, table.id),
  ],
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
    imageFocusX: smallint("image_focus_x").notNull().default(50),
    imageFocusY: smallint("image_focus_y").notNull().default(50),
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
    unique("menu_products_tenant_unique").on(t.businessId, t.id),
    check(
      "menu_products_variants_array",
      sql`jsonb_typeof(${t.variants}) = 'array' AND jsonb_array_length(${t.variants}) > 0`,
    ),
  ],
);

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

// Photo metadata lives here; the WebP files live in Neon Object Storage under storage_key.
// Without storage credentials (local dev, rows not yet copied) the bytes stay in large/small.
// Rows are immutable: replacing a photo uploads a new row, so URLs can be cached forever.
export const menuImages = pgTable(
  "menu_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    large: bytea("large"),
    small: bytea("small"),
    storageKey: text("storage_key"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("menu_images_business_idx").on(t.businessId, t.createdAt)],
);

export const storeSettings = pgTable("store_settings", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id),
  description: text("description").notNull().default(""),
  menuNote: text("menu_note").notNull().default(""),
  coverImageUrl: text("cover_image_url").notNull().default(""),
  coverFocusX: smallint("cover_focus_x").notNull().default(50),
  coverFocusY: smallint("cover_focus_y").notNull().default(50),
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
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("orders_request_unique").on(t.businessId, t.requestKey),
    unique("orders_tenant_unique").on(t.businessId, t.id),
    unique("orders_number_unique").on(t.businessId, t.number),
    index("orders_business_date_idx").on(t.businessId, t.createdAt),
    check(
      "orders_total_valid",
      sql`${t.totalCents} = ${t.subtotalCents} + ${t.deliveryCents} AND ${t.totalCents} >= 0`,
    ),
  ],
);

// Management uses exact decimals; pg returns numeric as strings.
export const managementSettings = pgTable(
  "management_settings",
  {
    businessId: uuid("business_id")
      .primaryKey()
      .references(() => businesses.id),
    cutoffHour: integer("cutoff_hour").notNull().default(4),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    check("management_cutoff_valid", sql`${t.cutoffHour} BETWEEN 0 AND 23`),
  ],
);

export const managementOperations = pgTable(
  "management_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    requestKey: uuid("request_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    type: varchar("type", { length: 30 }).notNull(),
    operationalDate: varchar("operational_date", { length: 10 }).notNull(),
    actorId: text("actor_id").notNull(),
    payload: jsonb("payload").notNull(),
    result: jsonb("result").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("management_operation_request").on(t.businessId, t.requestKey),
    unique("management_operation_tenant").on(t.businessId, t.id),
    index("management_operation_date").on(t.businessId, t.createdAt),
  ],
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    locationId: uuid("location_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    unit: varchar("unit", { length: 10 }).notNull(),
    minimum: numeric("minimum", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    quantity: numeric("quantity", { precision: 20, scale: 6 })
      .notNull()
      .default("0"),
    unitCost: numeric("unit_cost", { precision: 30, scale: 6 }),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("inventory_item_tenant").on(t.businessId, t.id),
    unique("inventory_item_name").on(t.businessId, t.locationId, t.name),
    foreignKey({
      columns: [t.businessId, t.locationId],
      foreignColumns: [locations.businessId, locations.id],
    }),
    check(
      "inventory_item_valid",
      sql`${t.kind} IN ('ingredient','finished') AND ${t.unit} IN ('g','ml','unit') AND ${t.minimum} >= 0 AND (${t.unitCost} IS NULL OR ${t.unitCost} >= 0)`,
    ),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    name: varchar("name", { length: 120 }).notNull(),
    contact: varchar("contact", { length: 200 }).notNull().default(""),
    note: text("note").notNull().default(""),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("supplier_tenant").on(t.businessId, t.id),
    unique("supplier_name").on(t.businessId, t.name),
  ],
);

export const recipes = pgTable(
  "management_recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    productId: uuid("product_id").notNull(),
    optionId: uuid("option_id").notNull(),
    optionKind: varchar("option_kind", { length: 10 }).notNull(),
    version: integer("version").notNull(),
    lines: jsonb("lines").notNull(),
    noConsumption: boolean("no_consumption").notNull().default(false),
    operationId: uuid("operation_id").notNull(),
  },
  (t) => [
    unique("recipe_revision").on(
      t.businessId,
      t.productId,
      t.optionId,
      t.optionKind,
      t.version,
    ),
    foreignKey({
      columns: [t.businessId, t.productId],
      foreignColumns: [menuProducts.businessId, menuProducts.id],
    }),
    foreignKey({
      columns: [t.businessId, t.operationId],
      foreignColumns: [
        managementOperations.businessId,
        managementOperations.id,
      ],
    }),
    check("recipe_kind_valid", sql`${t.optionKind} IN ('variant','addon')`),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    locationId: uuid("location_id").notNull(),
    itemId: uuid("item_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    kind: varchar("kind", { length: 30 }).notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 6 }).notNull(),
    costCents: numeric("cost_cents", { precision: 30, scale: 0 }),
    reason: text("reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inventory_movement_date").on(t.businessId, t.createdAt),
    foreignKey({
      columns: [t.businessId, t.itemId],
      foreignColumns: [inventoryItems.businessId, inventoryItems.id],
    }),
    foreignKey({
      columns: [t.businessId, t.operationId],
      foreignColumns: [
        managementOperations.businessId,
        managementOperations.id,
      ],
    }),
    foreignKey({
      columns: [t.businessId, t.locationId],
      foreignColumns: [locations.businessId, locations.id],
    }),
  ],
);

export const managementSales = pgTable(
  "management_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    locationId: uuid("location_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    orderId: uuid("order_id"),
    channel: varchar("channel", { length: 20 }).notNull(),
    note: text("note").notNull().default(""),
    totalCents: numeric("total_cents", { precision: 30, scale: 0 }).notNull(),
    deliveryCents: numeric("delivery_cents", { precision: 30, scale: 0 })
      .notNull()
      .default("0"),
    costCents: numeric("cost_cents", { precision: 30, scale: 0 }),
    knownCostCents: numeric("known_cost_cents", {
      precision: 30,
      scale: 0,
    }).notNull(),
    costComplete: boolean("cost_complete").notNull(),
    lines: jsonb("lines").notNull(),
    operationalDate: varchar("operational_date", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationId: uuid("cancellation_id"),
  },
  (t) => [
    unique("management_sale_tenant").on(t.businessId, t.id),
    unique("management_sale_order").on(t.businessId, t.orderId),
    unique("management_sale_operation").on(t.businessId, t.operationId),
    index("management_sale_date").on(t.businessId, t.operationalDate),
    foreignKey({
      columns: [t.businessId, t.locationId],
      foreignColumns: [locations.businessId, locations.id],
    }),
    foreignKey({
      columns: [t.businessId, t.operationId],
      foreignColumns: [
        managementOperations.businessId,
        managementOperations.id,
      ],
    }),
    foreignKey({
      columns: [t.businessId, t.orderId],
      foreignColumns: [orders.businessId, orders.id],
    }),
    foreignKey({
      columns: [t.businessId, t.cancellationId],
      foreignColumns: [
        managementOperations.businessId,
        managementOperations.id,
      ],
    }),
    check(
      "management_sale_valid",
      sql`${t.channel} IN ('store','counter','whatsapp','other') AND ${t.totalCents} >= 0 AND ${t.deliveryCents} >= 0 AND ${t.totalCents} >= ${t.deliveryCents}`,
    ),
  ],
);

export const expenses = pgTable(
  "management_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    supplierId: uuid("supplier_id"),
    date: varchar("date", { length: 10 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    concept: varchar("concept", { length: 120 }).notNull(),
    amountCents: numeric("amount_cents", { precision: 30, scale: 0 }).notNull(),
    note: text("note").notNull().default(""),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversalId: uuid("reversal_id"),
  },
  (t) => [
    index("management_expense_date").on(t.businessId, t.date),
    foreignKey({
      columns: [t.businessId, t.operationId],
      foreignColumns: [
        managementOperations.businessId,
        managementOperations.id,
      ],
    }),
    foreignKey({
      columns: [t.businessId, t.supplierId],
      foreignColumns: [suppliers.businessId, suppliers.id],
    }),
    foreignKey({
      columns: [t.businessId, t.reversalId],
      foreignColumns: [
        managementOperations.businessId,
        managementOperations.id,
      ],
    }),
    check("management_expense_positive", sql`${t.amountCents} > 0`),
  ],
);
