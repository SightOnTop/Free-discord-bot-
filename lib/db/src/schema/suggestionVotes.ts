import { pgTable, text, integer, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suggestionVotesTable = pgTable("suggestion_votes", {
  suggestionId: integer("suggestion_id").notNull(),
  userId: text("user_id").notNull(),
  vote: text("vote").notNull(),
}, (table) => ({
  suggestionVotesPk: primaryKey({ columns: [table.suggestionId, table.userId] }),
}));

export const insertSuggestionVoteSchema = createInsertSchema(suggestionVotesTable);
export type InsertSuggestionVote = z.infer<typeof insertSuggestionVoteSchema>;
export type SuggestionVote = typeof suggestionVotesTable.$inferSelect;
