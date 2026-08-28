import { type Client, type Message, EmbedBuilder } from "discord.js";
import { awardUserXp, getGuild } from "../utils/dbops.js";
import { logger } from "../../lib/logger.js";

const XP_COOLDOWN_MS = 60_000; // 1 minute between XP gains
const XP_MIN = 15;
const XP_MAX = 25;

/** XP needed to reach a given level */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

/** Level from total XP */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

/** Progress bar (10 segments) */
export function progressBar(current: number, needed: number, total = 10): string {
  const filled = Math.floor((current / needed) * total);
  const empty = total - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

export function setupLeveling(client: Client) {
  client.on("messageCreate", async (message: Message) => {
    try {
      if (message.author.bot || !message.guild) return;
      if (!message.content || message.content.startsWith("/")) return;

      const config = await getGuild(message.guild.id);
      if (!config?.levelUpEnabled) return;

      const xpGain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
      const awarded = await awardUserXp({
        guildId: message.guild.id,
        userId: message.author.id,
        now: new Date(),
        xpGain,
        cooldownMs: XP_COOLDOWN_MS,
      });
      if (!awarded || awarded.newLevel <= awarded.oldLevel) return;

      const embed = new EmbedBuilder()
        .setColor(0x00d26a)
        .setTitle("⬆️ Level Up !")
        .setDescription(`${message.author} vient de passer au **niveau ${awarded.newLevel}** ! 🎉`)
        .addFields({ name: "📊 XP total", value: `${awarded.newXp.toLocaleString()}`, inline: true })
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: "Moderax • Système de niveaux" })
        .setTimestamp();

      const targetChannelId = config.levelUpChannelId ?? message.channel.id;
      const targetChannel = message.guild.channels.cache.get(targetChannelId);
      const channel = targetChannel?.isTextBased() ? targetChannel : message.channel;
      if (channel.isTextBased() && !channel.isDMBased()) {
        await channel.send({ content: `${message.author}`, embeds: [embed] }).catch(() => null);
      }
    } catch (err) {
      logger.error({ err, guildId: message.guild?.id, userId: message.author.id }, "[Leveling] Erreur traitement XP");
    }
  });
}
