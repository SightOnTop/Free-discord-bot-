import { eq, and, desc, asc, sql, lt, gt } from "drizzle-orm";
import {
  db,
  guildsTable, warningsTable, ticketsTable, modlogsTable,
  levelsTable, badwordsTable, giveawaysTable, remindersTable,
  suggestionsTable, suggestionVotesTable, temprolesTable, pollsTable, pollVotesTable,
} from "@workspace/db";
import type {
  InsertGuild, InsertWarning, InsertTicket, InsertModlog,
  InsertLevel, InsertBadword, InsertGiveaway, InsertReminder,
  InsertSuggestion, InsertSuggestionVote, InsertTemprole, InsertPoll, InsertPollVote,
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

// ── Atomic interaction state ──────────────────────────────────────────────────

export async function toggleGiveawayEntry(id: number, userId: string) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(giveawaysTable).where(eq(giveawaysTable.id, id)).for("update");
    const giveaway = rows[0];
    if (!giveaway || giveaway.ended) return null;
    const joined = giveaway.entries.includes(userId);
    const entries = joined ? giveaway.entries.filter((entry) => entry !== userId) : [...giveaway.entries, userId];
    await tx.update(giveawaysTable).set({ entries }).where(eq(giveawaysTable.id, id));
    return { giveaway: { ...giveaway, entries }, added: !joined };
  });
}

export async function awardUserXp(data: { guildId: string; userId: string; now: Date; xpGain: number; cooldownMs: number }) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(levelsTable)
      .where(and(eq(levelsTable.guildId, data.guildId), eq(levelsTable.userId, data.userId)))
      .for("update");
    const existing = rows[0];
    if (existing?.lastXpAt && data.now.getTime() - existing.lastXpAt.getTime() < data.cooldownMs) return null;
    const oldXp = existing?.xp ?? 0;
    const oldLevel = existing?.level ?? 0;
    const newXp = oldXp + data.xpGain;
    const newLevel = Math.floor(Math.sqrt(newXp / 100));
    const totalMessages = (existing?.totalMessages ?? 0) + 1;
    await tx.insert(levelsTable).values({ guildId: data.guildId, userId: data.userId, xp: newXp, level: newLevel, totalMessages, lastXpAt: data.now }).onConflictDoUpdate({
      target: [levelsTable.guildId, levelsTable.userId],
      set: { xp: newXp, level: newLevel, totalMessages, lastXpAt: data.now },
    });
    return { oldLevel, newLevel, newXp, totalMessages };
  });
}

export async function getActiveTemproles() {
  return db.select().from(temprolesTable).where(gt(temprolesTable.expiresAt, new Date()));
}

export async function createPoll(data: InsertPoll) {
  const rows = await db.insert(pollsTable).values(data).returning();
  return rows[0]!;
}

export async function updatePoll(id: number, data: Partial<InsertPoll>) {
  await db.update(pollsTable).set(data).where(eq(pollsTable.id, id));
}

export async function deletePoll(id: number) {
  await db.delete(pollsTable).where(eq(pollsTable.id, id));
}

export async function getPollByMessageId(messageId: string) {
  const rows = await db.select().from(pollsTable).where(eq(pollsTable.messageId, messageId)).limit(1);
  return rows[0] ?? null;
}

export async function getActivePolls() {
  return db.select().from(pollsTable).where(eq(pollsTable.closed, false));
}

export async function getPollVote(pollId: number, userId: string) {
  const rows = await db.select().from(pollVotesTable).where(and(eq(pollVotesTable.pollId, pollId), eq(pollVotesTable.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function recordPollVote(data: InsertPollVote) {
  const rows = await db.insert(pollVotesTable).values(data).onConflictDoUpdate({
    target: [pollVotesTable.pollId, pollVotesTable.userId],
    set: { optionIndex: data.optionIndex },
  }).returning();
  return rows[0]!;
}

export async function getPollVoteCounts(pollId: number) {
  const rows = await db.select({ optionIndex: pollVotesTable.optionIndex, count: sql<number>`count(*)` }).from(pollVotesTable)
    .where(eq(pollVotesTable.pollId, pollId)).groupBy(pollVotesTable.optionIndex);
  return rows.map((row) => ({ optionIndex: row.optionIndex, count: Number(row.count) }));
}

export async function castSuggestionVote(data: InsertSuggestionVote) {
  return db.transaction(async (tx) => {
    const rows = await tx.insert(suggestionVotesTable).values(data).onConflictDoNothing().returning();
    if (!rows[0]) return false;
    if (data.vote === "up") {
      await tx.update(suggestionsTable).set({ upvotes: sql`${suggestionsTable.upvotes} + 1` }).where(eq(suggestionsTable.id, data.suggestionId));
    } else {
      await tx.update(suggestionsTable).set({ downvotes: sql`${suggestionsTable.downvotes} + 1` }).where(eq(suggestionsTable.id, data.suggestionId));
    }
    return true;
  });
}
