import { EmbedBuilder, type Guild } from "discord.js";
import { getGuild, getUserWarnings } from "../utils/dbops.js";
import { logger } from "../../lib/logger.js";

const THRESHOLDS = [
  { warns: 3, action: "timeout", duration: 60 * 60 * 1_000,      label: "Timeout 1h" },
  { warns: 5, action: "timeout", duration: 24 * 60 * 60 * 1_000, label: "Timeout 24h" },
  { warns: 7, action: "ban",     duration: 0,                     label: "Ban permanent" },
] as const;

export async function checkEscalation(guild: Guild, userId: string, reason: string) {
  const config = await getGuild(guild.id);
  if (!config?.autoEscalationEnabled) return;

  const warnings = await getUserWarnings(guild.id, userId);
  const count    = warnings.length;

  // Find the highest matching threshold
  const threshold = [...THRESHOLDS].reverse().find((t) => count >= t.warns);
  if (!threshold) return;

  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (member.id === guild.ownerId) return;

    const me = guild.members.me;
    if (!me) return;
    if (me.roles.highest.comparePositionTo(member.roles.highest) <= 0) return;

    if (threshold.action === "timeout") {
      await member.timeout(threshold.duration, `[Auto-escalade] ${count} avertissements — ${reason}`);
    } else {
      await guild.members.ban(userId, { reason: `[Auto-escalade] ${count} avertissements — Ban automatique` });
    }

    // Log to configured log channel
    if (config.logChannelId) {
      const logChannel = guild.channels.cache.get(config.logChannelId);
      if (logChannel?.isTextBased()) {
        await logChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xff3b30)
            .setTitle("⚡ Auto-Escalade déclenchée")
            .addFields(
              { name: "👤 Utilisateur",     value: `<@${userId}>`,  inline: true },
              { name: "⚠️ Avertissements",  value: `${count}`,      inline: true },
              { name: "⚡ Sanction",         value: threshold.label, inline: true },
            )
            .setFooter({ text: "Moderax • Auto-Escalade" })
            .setTimestamp()],
        });
      }
    }

    logger.info({ userId, count, action: threshold.action }, "[AutoEscalation] Sanction appliquée");
  } catch (err) {
    logger.error({ err }, "[AutoEscalation] Erreur lors de l'escalade");
  }
}
