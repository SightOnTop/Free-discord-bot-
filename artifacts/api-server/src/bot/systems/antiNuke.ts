import {
  type Client,
  AuditLogEvent,
  PermissionsBitField,
  type Guild,
  type GuildAuditLogsEntry,
} from "discord.js";
import { getGuild } from "../utils/dbops.js";
import { logger } from "../../lib/logger.js";

// In-memory action tracker: userId → { count, timer }
interface ActionTracker {
  count: number;
  timer: NodeJS.Timeout;
}

const banTracker = new Map<string, ActionTracker>();
const kickTracker = new Map<string, ActionTracker>();
const channelDeleteTracker = new Map<string, ActionTracker>();
const roleDeleteTracker = new Map<string, ActionTracker>();
const webhookCreateTracker = new Map<string, ActionTracker>();

const WINDOW_MS = 10_000; // 10 seconds
const THRESHOLDS = { ban: 3, kick: 3, channelDelete: 3, roleDelete: 3, webhookCreate: 5 };

function track(map: Map<string, ActionTracker>, key: string, threshold: number, onExceed: () => void) {
  const existing = map.get(key);
  if (existing) {
    existing.count++;
    if (existing.count >= threshold) {
      clearTimeout(existing.timer);
      map.delete(key);
      onExceed();
    }
  } else {
    const timer = setTimeout(() => map.delete(key), WINDOW_MS);
    map.set(key, { count: 1, timer });
  }
}

async function quarantine(guild: Guild, userId: string, reason: string, client: Client) {
  try {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionsBitField.Flags.BanMembers)) return;

    // Try to ban the attacker
    await guild.members.ban(userId, { reason: `[MODERAX ANTI-NUKE] ${reason}`, deleteMessageSeconds: 0 });

    // Log to log channel
    const config = await getGuild(guild.id);
    if (config?.logChannelId) {
      const channel = guild.channels.cache.get(config.logChannelId);
      if (channel?.isTextBased()) {
        const { EmbedBuilder } = await import("discord.js");
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("🚨 ANTI-NUKE — Menace neutralisée")
          .addFields(
            { name: "🎯 Attaquant", value: `<@${userId}> (\`${userId}\`)`, inline: true },
            { name: "📋 Raison", value: reason, inline: true },
          )
          .setFooter({ text: "Moderax Anti-Nuke" })
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
    logger.info({ userId, reason }, "[AntiNuke] Attaquant banni");
  } catch (err) {
    logger.error({ err }, "[AntiNuke] Erreur lors de la quarantaine");
  }
}

async function handleAuditLog(
  guild: Guild,
  event: AuditLogEvent,
  tracker: Map<string, ActionTracker>,
  threshold: number,
  label: string,
  client: Client
) {
  const config = await getGuild(guild.id);
  if (!config?.antiNukeEnabled) return;

  try {
    const logs = await guild.fetchAuditLogs({ type: event, limit: 1 });
    const entry = logs.entries.first() as GuildAuditLogsEntry | undefined;
    if (!entry) return;

    const executorId = entry.executor?.id;
    if (!executorId) return;
    if (executorId === client.user?.id) return;

    // Owner is always trusted
    if (executorId === guild.ownerId) return;

    track(tracker, `${guild.id}:${executorId}`, threshold, () => {
      void quarantine(guild, executorId, label, client);
    });
  } catch {
    // Silently ignore permission errors
  }
}

export function setupAntiNuke(client: Client) {
  client.on("guildBanAdd", async (ban) => {
    await handleAuditLog(ban.guild, AuditLogEvent.MemberBanAdd, banTracker, THRESHOLDS.ban, "Mass-ban détecté", client);
  });

  client.on("guildMemberRemove", async (member) => {
    if (!member.guild) return;
    await handleAuditLog(member.guild, AuditLogEvent.MemberKick, kickTracker, THRESHOLDS.kick, "Mass-kick détecté", client);
  });

  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAuditLog(channel.guild, AuditLogEvent.ChannelDelete, channelDeleteTracker, THRESHOLDS.channelDelete, "Suppression massive de salons détectée", client);
  });

  client.on("roleDelete", async (role) => {
    await handleAuditLog(role.guild, AuditLogEvent.RoleDelete, roleDeleteTracker, THRESHOLDS.roleDelete, "Suppression massive de rôles détectée", client);
  });

  client.on("webhookUpdate", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAuditLog(channel.guild, AuditLogEvent.WebhookCreate, webhookCreateTracker, THRESHOLDS.webhookCreate, "Création massive de webhooks détectée", client);
  });
}
