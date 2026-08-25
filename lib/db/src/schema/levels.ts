import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const levelsTable = pgTable("levels", {
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(0).notNull(),
  totalMessages: integer("total_messages").default(0).notNull(),
  lastXpAt: timestamp("last_xp_at"),
});

export const insertLevelSchema = createInsertSchema(levelsTable);
export type InsertLevel = z.infer<typeof insertLevelSchema>;
export type Level = typeof levelsTable.$inferSelect;
