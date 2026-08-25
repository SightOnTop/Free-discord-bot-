import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modlogsTable = pgTable("modlogs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  moderatorId: text("moderator_id").notNull(),
  action: text("action").notNull(), // ban | kick | mute | unmute | warn | timeout | lock | unlock
  reason: text("reason"),
  duration: text("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertModlogSchema = createInsertSchema(modlogsTable).omit({ id: true });
export type InsertModlog = z.infer<typeof insertModlogSchema>;
export type Modlog = typeof modlogsTable.$inferSelect;
