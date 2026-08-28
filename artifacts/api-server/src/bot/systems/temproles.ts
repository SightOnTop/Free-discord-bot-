import type { Client } from "discord.js";
import { getExpiredTemproles, deleteTemprole, createTemprole } from "../utils/dbops.js";
import { parseDuration, MAX_TIMEOUT_MS } from "../utils/time.js";
import { logger } from "../../lib/logger.js";
import type { InsertTemprole } from "@workspace/db";

const scheduled = new Map<number, NodeJS.Timeout>();

async function removeTemprole(client: Client, id: number, guildId: string, userId: string, roleId: string) {
  try {
    await deleteTemprole(id);
    scheduled.delete(id);
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    await member.roles.remove(roleId, "Rôle temporaire expiré").catch(() => null);
    logger.info({ userId, roleId, guildId }, "[TempRole] Rôle expiré retiré");
  } catch (err) {
    logger.error({ err }, "[TempRole] Erreur retrait rôle");
  }
}

function scheduleTemprole(client: Client, id: number, guildId: string, userId: string, roleId: string, expiresAt: Date) {
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) { void removeTemprole(client, id, guildId, userId, roleId); return; }
  const timer = setTimeout(() => {
    const remaining = expiresAt.getTime() - Date.now();
    if (remaining > 0) {
      scheduleTemprole(client, id, guildId, userId, roleId, expiresAt);
      return;
    }
    void removeTemprole(client, id, guildId, userId, roleId);
  }, Math.min(ms, MAX_TIMEOUT_MS));
  scheduled.set(id, timer);
}

export async function addTemprole(client: Client, data: InsertTemprole) {
  const role = await createTemprole(data);
  scheduleTemprole(client, role.id, data.guildId, data.userId, data.roleId, data.expiresAt);
  return role;
}

export async function setupTemproles(client: Client) {
  try {
    const expired = await getExpiredTemproles();
    for (const tr of expired) {
      await removeTemprole(client, tr.id, tr.guildId, tr.userId, tr.roleId);
    }
    logger.info(`[TempRole] ${expired.length} rôle(s) temporaire(s) expiré(s) traité(s)`);
  } catch (err) {
    logger.error({ err }, "[TempRole] Erreur restauration");
  }
}

export { parseDuration };
