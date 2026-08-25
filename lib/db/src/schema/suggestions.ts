import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suggestionsTable = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  channelId: text("channel_id"),
  messageId: text("message_id"),
  content: text("content").notNull(),
  status: text("status").default("pending").notNull(), // pending | approved | denied
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  response: text("response"),
  respondedById: text("responded_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSuggestionSchema = createInsertSchema(suggestionsTable).omit({ id: true });
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type Suggestion = typeof suggestionsTable.$inferSelect;
