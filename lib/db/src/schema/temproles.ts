import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const temprolesTable = pgTable("temp_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTemproleSchema = createInsertSchema(temprolesTable).omit({ id: true });
export type InsertTemprole = z.infer<typeof insertTemproleSchema>;
export type Temprole = typeof temprolesTable.$inferSelect;
