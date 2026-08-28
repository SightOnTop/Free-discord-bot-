import { eq, and, desc, asc, sql, lt } from "drizzle-orm";
import {
  db,
  guildsTable, warningsTable, ticketsTable, modlogsTable,
  levelsTable, badwordsTable, giveawaysTable, remindersTable,
  suggestionsTable, temprolesTable,
} from "@workspace/db";
import type {
  InsertGuild, InsertWarning, InsertTicket, InsertModlog,
  InsertLevel, InsertBadword, InsertGiveaway, InsertReminder,
  InsertSuggestion, InsertTemprole,
} from "@workspace/db";

// ── Guild Config ──────────────────────────────────────────────────────────────

export async function getGuild(guildId: string) {
  const rows = await db.select().from(guildsTable).where(eq(guildsTable.guildId, guildId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertGuild(data: InsertGuild) {
  await db.insert(guildsTable).values(data).onConflictDoUpdate({
    target: guildsTable.guildId,
    set: { ...data, updatedAt: new Date() },
  });
}

export async function updateGuild(guildId: string, data: Partial<InsertGuild>) {
  const existing = await getGuild(guildId);
  if (!existing) await db.insert(guildsTable).values({ guildId, ...data });
  else await db.update(guildsTable).set({ ...data, updatedAt: new Date() }).where(eq(guildsTable.guildId, guildId));
}

// ── Warnings ──────────────────────────────────────────────────────────────────

export async function addWarning(data: InsertWarning) {
  const rows = await db.insert(warningsTable).values(data).returning();
  return rows[0]!;
}

export async function getUserWarnings(guildId: string, userId: string) {
  return db.select().from(warningsTable)
    .where(and(eq(warningsTable.guildId, guildId), eq(warningsTable.userId, userId)))
    .orderBy(desc(warningsTable.createdAt));
}

export async function deleteWarning(id: number) {
  await db.delete(warningsTable).where(eq(warningsTable.id, id));
}

export async function clearUserWarnings(guildId: string, userId: string) {
  await db.delete(warningsTable).where(and(eq(warningsTable.guildId, guildId), eq(warningsTable.userId, userId)));
}

// ── Tickets ───────────────────────────────────────────────────────────────────

export async function createTicket(data: InsertTicket) {
  const rows = await db.insert(ticketsTable).values(data).returning();
  return rows[0]!;
}

export async function getTicketByChannel(channelId: string) {
  const rows = await db.select().from(ticketsTable).where(eq(ticketsTable.channelId, channelId)).limit(1);
  return rows[0] ?? null;
}

export async function closeTicket(channelId: string, closedById: string) {
  await db.update(ticketsTable).set({ status: "closed", closedAt: new Date(), closedById }).where(eq(ticketsTable.channelId, channelId));
}

// ── Mod Logs ──────────────────────────────────────────────────────────────────

export async function addModlog(data: InsertModlog) {
  await db.insert(modlogsTable).values(data);
}

// ── Leveling ──────────────────────────────────────────────────────────────────

export async function getUserLevel(guildId: string, userId: string) {
  const rows = await db.select().from(levelsTable)
    .where(and(eq(levelsTable.guildId, guildId), eq(levelsTable.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function upsertUserLevel(data: InsertLevel) {
  await db.insert(levelsTable).values(data).onConflictDoUpdate({
    target: [levelsTable.guildId, levelsTable.userId],
    set: { xp: data.xp, level: data.level, totalMessages: data.totalMessages, lastXpAt: data.lastXpAt },
  });
}

export async function getLeaderboard(guildId: string, limit = 10) {
  return db.select().from(levelsTable)
    .where(eq(levelsTable.guildId, guildId))
    .orderBy(desc(levelsTable.xp))
    .limit(limit);
}

export async function getUserRank(guildId: string, userId: string) {
  const userLevel = await getUserLevel(guildId, userId);
  if (!userLevel) return null;
  const above = await db.select({ count: sql<number>`count(*)` }).from(levelsTable)
    .where(and(eq(levelsTable.guildId, guildId), sql`${levelsTable.xp} > ${userLevel.xp}`));
  const rank = Number(above[0]?.count ?? 0) + 1;
  return { ...userLevel, rank };
}

// ── Badwords ──────────────────────────────────────────────────────────────────

export async function addBadword(data: InsertBadword) {
  await db.insert(badwordsTable).values(data);
}

export async function removeBadword(guildId: string, word: string) {
  await db.delete(badwordsTable).where(and(eq(badwordsTable.guildId, guildId), eq(badwordsTable.word, word.toLowerCase())));
}

export async function getGuildBadwords(guildId: string) {
  return db.select().from(badwordsTable).where(eq(badwordsTable.guildId, guildId)).orderBy(asc(badwordsTable.word));
}

// ── Giveaways ─────────────────────────────────────────────────────────────────

export async function createGiveaway(data: InsertGiveaway) {
  const rows = await db.insert(giveawaysTable).values(data).returning();
  return rows[0]!;
}

export async function updateGiveaway(id: number, data: Partial<InsertGiveaway>) {
  await db.update(giveawaysTable).set(data).where(eq(giveawaysTable.id, id));
}

export async function getGiveawayById(id: number) {
  const rows = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveGiveaways() {
  return db.select().from(giveawaysTable).where(eq(giveawaysTable.ended, false));
}

export async function getExpiredGiveaways() {
  return db.select().from(giveawaysTable).where(and(eq(giveawaysTable.ended, false), lt(giveawaysTable.endsAt, new Date())));
}

// ── Reminders ─────────────────────────────────────────────────────────────────

export async function createReminder(data: InsertReminder) {
  const rows = await db.insert(remindersTable).values(data).returning();
  return rows[0]!;
}

export async function getUserReminders(userId: string) {
  return db.select().from(remindersTable)
    .where(and(eq(remindersTable.userId, userId), eq(remindersTable.sent, false)))
    .orderBy(asc(remindersTable.remindAt));
}

export async function markReminderSent(id: number) {
  await db.update(remindersTable).set({ sent: true }).where(eq(remindersTable.id, id));
}

export async function deleteReminder(id: number, userId: string) {
  await db.delete(remindersTable).where(and(eq(remindersTable.id, id), eq(remindersTable.userId, userId)));
}

export async function getPendingReminders() {
  return db.select().from(remindersTable).where(and(eq(remindersTable.sent, false), lt(remindersTable.remindAt, new Date())));
}

export async function getUnsentReminders() {
  return db.select().from(remindersTable)
    .where(eq(remindersTable.sent, false))
    .orderBy(asc(remindersTable.remindAt));
}

// ── Suggestions ───────────────────────────────────────────────────────────────

export async function createSuggestion(data: InsertSuggestion) {
  const rows = await db.insert(suggestionsTable).values(data).returning();
  return rows[0]!;
}

export async function updateSuggestion(id: number, data: Partial<InsertSuggestion>) {
  await db.update(suggestionsTable).set(data).where(eq(suggestionsTable.id, id));
}

export async function getSuggestionByMessageId(messageId: string) {
  const rows = await db.select().from(suggestionsTable).where(eq(suggestionsTable.messageId, messageId)).limit(1);
  return rows[0] ?? null;
}

// ── Temp Roles ────────────────────────────────────────────────────────────────

export async function createTemprole(data: InsertTemprole) {
  const rows = await db.insert(temprolesTable).values(data).returning();
  return rows[0]!;
}

export async function getExpiredTemproles() {
  return db.select().from(temprolesTable).where(lt(temprolesTable.expiresAt, new Date()));
}

export async function deleteTemprole(id: number) {
  await db.delete(temprolesTable).where(eq(temprolesTable.id, id));
}
