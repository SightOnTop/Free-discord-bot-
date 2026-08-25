import { type Client, type Message, PermissionsBitField } from "discord.js";
import { getGuild, getGuildBadwords, addWarning, getUserWarnings } from "../utils/dbops.js";
import { dangerEmbed } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";

// Cache: guildId → Set<word>
const badwordCache = new Map<string, Set<string>>();

export function invalidateBadwordCache(guildId: string) {
  badwordCache.delete(guildId);
}

async function getBadwords(guildId: string): Promise<Set<string>> {
  if (badwordCache.has(guildId)) return badwordCache.get(guildId)!;
  const words = await getGuildBadwords(guildId);
  const set = new Set(words.map((w) => w.word.toLowerCase()));
  badwordCache.set(guildId, set);
  return set;
}

export function setupBadwords(client: Client) {
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot || !message.guild || !message.member) return;
    if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

    const config = await getGuild(message.guild.id);
    if (!config?.badwordsEnabled) return;

    const badwords = await getBadwords(message.guild.id);
    if (badwords.size === 0) return;

    const content = message.content.toLowerCase();
    const found = [...badwords].find((w) => content.includes(w));
    if (!found) return;

    try {
      await message.delete();

      const warning = await addWarning({
        guildId: message.guild.id,
        userId: message.author.id,
        moderatorId: message.client.user!.id,
        reason: `[Filtre] Mot interdit utilisé`,
      });

      const warns = await getUserWarnings(message.guild.id, message.author.id);

      // Warn in channel (auto-delete after 5s)
      if (message.channel.isTextBased() && !message.channel.isDMBased()) {
        await message.channel.send({
          embeds: [dangerEmbed("Mot interdit", `${message.author} — Ce mot est interdit sur ce serveur.\nAvertissement **#${warns.length}**`)],
        }).then((m) => setTimeout(() => m.delete().catch(() => null), 5000));
      }

      // Log
      if (config.logChannelId) {
        const logCh = message.guild.channels.cache.get(config.logChannelId);
        if (logCh?.isTextBased()) {
          const { EmbedBuilder } = await import("discord.js");
          await logCh.send({
            embeds: [new EmbedBuilder().setColor(0xff9f0a).setTitle("🚫 Filtre Anti-Profanité")
              .addFields(
                { name: "👤 Auteur", value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
                { name: "📋 Mot détecté", value: `||${found}||`, inline: true },
                { name: "💬 Salon", value: `${message.channel}`, inline: true },
                { name: "⚠️ Avertissement", value: `#${warning.id}`, inline: true },
              ).setFooter({ text: "Moderax • Filtre Anti-Profanité" }).setTimestamp()],
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "[Badwords] Erreur");
    }
  });
}
