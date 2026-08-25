import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildsTable = pgTable("guilds", {
  guildId: text("guild_id").primaryKey(),
  // Moderation
  muteRoleId: text("mute_role_id"),
  logChannelId: text("log_channel_id"),
  reportChannelId: text("report_channel_id"),
  // Welcome & Roles
  autoRoleId: text("auto_role_id"),
  welcomeChannelId: text("welcome_channel_id"),
  // Tickets
  ticketCategoryId: text("ticket_category_id"),
  ticketLogChannelId: text("ticket_log_channel_id"),
  // Captcha
  captchaEnabled: boolean("captcha_enabled").default(false),
  captchaChannelId: text("captcha_channel_id"),
  captchaRoleId: text("captcha_role_id"),
  // Anti-Nuke & Anti-Spam
  antiNukeEnabled: boolean("anti_nuke_enabled").default(true),
  antiSpamEnabled: boolean("anti_spam_enabled").default(true),
  // Badwords filter
  badwordsEnabled: boolean("badwords_enabled").default(false),
  // Leveling
  levelUpEnabled: boolean("level_up_enabled").default(true),
  levelUpChannelId: text("level_up_channel_id"),
  // Community
  suggestionChannelId: text("suggestion_channel_id"),
  // Auto-escalation
  autoEscalationEnabled: boolean("auto_escalation_enabled").default(false),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGuildSchema = createInsertSchema(guildsTable);
export type InsertGuild = z.infer<typeof insertGuildSchema>;
export type Guild = typeof guildsTable.$inferSelect;
