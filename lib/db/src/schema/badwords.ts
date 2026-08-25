import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const badwordsTable = pgTable("badwords", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  word: text("word").notNull(),
  addedById: text("added_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBadwordSchema = createInsertSchema(badwordsTable).omit({ id: true });
export type InsertBadword = z.infer<typeof insertBadwordSchema>;
export type Badword = typeof badwordsTable.$inferSelect;
