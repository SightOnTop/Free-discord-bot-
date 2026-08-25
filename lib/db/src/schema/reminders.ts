import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  guildId: text("guild_id"),
  channelId: text("channel_id").notNull(),
  message: text("message").notNull(),
  remindAt: timestamp("remind_at").notNull(),
  sent: boolean("sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReminderSchema = createInsertSchema(remindersTable).omit({ id: true });
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof remindersTable.$inferSelect;
