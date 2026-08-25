import { type Client, type Message, EmbedBuilder } from "discord.js";
import { getUserLevel, upsertUserLevel, getGuild } from "../utils/dbops.js";

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
    if (message.author.bot || !message.guild) return;
    if (!message.content || message.content.startsWith("/")) return;

    const config = await getGuild(message.guild.id);
    if (!config?.levelUpEnabled) return;

    const now = new Date();
    const existing = await getUserLevel(message.guild.id, message.author.id);

    // Cooldown check
    if (existing?.lastXpAt && now.getTime() - existing.lastXpAt.getTime() < XP_COOLDOWN_MS) return;

    const xpGain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
    const oldXp = existing?.xp ?? 0;
    const newXp = oldXp + xpGain;
    const oldLevel = existing?.level ?? 0;
    const newLevel = levelFromXp(newXp);

    await upsertUserLevel({
      guildId: message.guild.id,
      userId: message.author.id,
      xp: newXp,
      level: newLevel,
      totalMessages: (existing?.totalMessages ?? 0) + 1,
      lastXpAt: now,
    });

    // Level up notification
    if (newLevel > oldLevel) {
      const embed = new EmbedBuilder()
        .setColor(0x00d26a)
        .setTitle("⬆️ Level Up !")
        .setDescription(`${message.author} vient de passer au **niveau ${newLevel}** ! 🎉`)
        .addFields({ name: "📊 XP total", value: `${newXp.toLocaleString()}`, inline: true })
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: "Moderax • Système de niveaux" })
        .setTimestamp();

      // Send to dedicated channel or current channel
      const targetChannelId = config.levelUpChannelId ?? message.channel.id;
      const targetChannel = message.guild.channels.cache.get(targetChannelId);
      const ch = targetChannel?.isTextBased() ? targetChannel : message.channel;
      if (ch.isTextBased() && !ch.isDMBased()) {
        await ch.send({ content: `${message.author}`, embeds: [embed] }).catch(() => null);
      }
    }
  });
}
