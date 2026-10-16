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
} from "drizzle-orm/pg-core";

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
