import { pgTable, text, integer, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const giveawaysTable = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  hostedById: text("hosted_by_id").notNull(),
  prize: text("prize").notNull(),
  winnersCount: integer("winners_count").default(1).notNull(),
  entries: text("entries").array().default([]).notNull(), // array of userIds
  ended: boolean("ended").default(false).notNull(),
  winners: text("winners").array().default([]).notNull(),
  endsAt: timestamp("ends_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGiveawaySchema = createInsertSchema(giveawaysTable).omit({ id: true });
export type InsertGiveaway = z.infer<typeof insertGiveawaySchema>;
export type Giveaway = typeof giveawaysTable.$inferSelect;
