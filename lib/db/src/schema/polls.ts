import { pgTable, text, integer, serial, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pollsTable = pgTable("polls", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  createdById: text("created_by_id").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  closed: boolean("closed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pollVotesTable = pgTable("poll_votes", {
  pollId: integer("poll_id").notNull(),
  userId: text("user_id").notNull(),
  optionIndex: integer("option_index").notNull(),
}, (table) => ({
  pollVotesPk: primaryKey({ columns: [table.pollId, table.userId] }),
}));

export const insertPollSchema = createInsertSchema(pollsTable).omit({ id: true });
export const insertPollVoteSchema = createInsertSchema(pollVotesTable);
export type InsertPoll = z.infer<typeof insertPollSchema>;
export type Poll = typeof pollsTable.$inferSelect;
export type InsertPollVote = z.infer<typeof insertPollVoteSchema>;
export type PollVote = typeof pollVotesTable.$inferSelect;
