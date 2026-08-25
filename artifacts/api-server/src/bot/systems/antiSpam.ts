import { type Client, type Message, PermissionsBitField } from "discord.js";
import { getGuild, addWarning, getUserWarnings } from "../utils/dbops.js";
import { dangerEmbed, warningEmbed } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";

interface SpamData {
  messages: number;
  timer: NodeJS.Timeout;
  lastContent: string;
  duplicateCount: number;
}

const spamMap = new Map<string, SpamData>();

const SPAM_LIMIT = 6;        // messages in window
const DUPLICATE_LIMIT = 4;   // identical messages
const WINDOW_MS = 5_000;     // 5 seconds
const MUTE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

async function warnAndMute(message: Message, reason: string) {
  const { guild, member, author, channel } = message;
  if (!guild || !member) return;

  const config = await getGuild(guild.id);
  if (!config?.antiSpamEnabled) return;

  try {
    // Delete spam messages
    await message.delete().catch(() => null);

    // Add a warning
    await addWarning({
      guildId: guild.id,
      userId: author.id,
      moderatorId: message.client.user!.id,
      reason: `[Anti-Spam] ${reason}`,
    });

    const warnings = await getUserWarnings(guild.id, author.id);
    const warnCount = warnings.length;

    // Timeout if ≥3 warnings or mute role available
    if (config.muteRoleId && member.roles.cache.has(config.muteRoleId)) {
      // Already muted
      return;
    }

    if (warnCount >= 3 || reason.includes("flood")) {
      // Timeout for 5 minutes via Discord API
      await member.timeout(MUTE_DURATION_MS, `[Anti-Spam] ${reason}`).catch(() => null);

      if (config.muteRoleId) {
        await member.roles.add(config.muteRoleId).catch(() => null);
        setTimeout(() => {
          member.roles.remove(config.muteRoleId!).catch(() => null);
        }, MUTE_DURATION_MS);
      }

      if (channel.isTextBased() && !channel.isDMBased()) {
        await channel.send({
          embeds: [dangerEmbed("Anti-Spam — Mute automatique", `${author} a été muté 5 minutes pour spam.\nAvertissements : **${warnCount}**`)],
        }).then((msg: import("discord.js").Message) => setTimeout(() => msg.delete().catch(() => null), 8000));
      }
    } else if (channel.isTextBased() && !channel.isDMBased()) {
      await channel.send({
        embeds: [warningEmbed("Anti-Spam", `${author} — **${reason}**\nAvertissement #${warnCount}`)],
      }).then((msg: import("discord.js").Message) => setTimeout(() => msg.delete().catch(() => null), 6000));
    }

    // Log to log channel
    if (config.logChannelId) {
      const logChannel = guild.channels.cache.get(config.logChannelId);
      if (logChannel?.isTextBased()) {
        const { EmbedBuilder } = await import("discord.js");
        await logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff9f0a)
              .setTitle("🚫 Anti-Spam déclenché")
              .addFields(
                { name: "👤 Utilisateur", value: `${author.tag} (\`${author.id}\`)`, inline: true },
                { name: "📋 Raison", value: reason, inline: true },
                { name: "⚠️ Avertissements", value: `${warnCount}`, inline: true },
              )
              .setFooter({ text: "Moderax Anti-Spam" })
              .setTimestamp(),
          ],
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "[AntiSpam] Erreur");
  }
}

export function setupAntiSpam(client: Client) {
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guild || !message.member) return;

    // Skip admins and mods
    if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    const config = await getGuild(message.guild.id);
    if (!config?.antiSpamEnabled) return;

    const key = `${message.guild.id}:${message.author.id}`;
    const existing = spamMap.get(key);

    if (existing) {
      existing.messages++;

      // Check duplicate
      if (message.content && message.content === existing.lastContent) {
        existing.duplicateCount++;
        if (existing.duplicateCount >= DUPLICATE_LIMIT) {
          clearTimeout(existing.timer);
          spamMap.delete(key);
          await warnAndMute(message, "Messages identiques répétés");
          return;
        }
      } else {
        existing.lastContent = message.content;
        existing.duplicateCount = 1;
      }

      // Check flood
      if (existing.messages >= SPAM_LIMIT) {
        clearTimeout(existing.timer);
        spamMap.delete(key);
        await warnAndMute(message, "Flood de messages détecté");
      }
    } else {
      const timer = setTimeout(() => spamMap.delete(key), WINDOW_MS);
      spamMap.set(key, { messages: 1, timer, lastContent: message.content, duplicateCount: 1 });
    }
  });
}
