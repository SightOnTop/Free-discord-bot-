import {
  type Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type ButtonInteraction,
} from "discord.js";
import {
  createGiveaway, updateGiveaway, getActiveGiveaways, getGiveawayById, getExpiredGiveaways,
} from "../utils/dbops.js";
import { parseDuration, formatDuration, discordTimestamp } from "../utils/time.js";
import { successEmbed, dangerEmbed } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";
import type { Giveaway } from "@workspace/db";

const timers = new Map<number, NodeJS.Timeout>();

function giveawayEmbed(g: Giveaway, ended = false) {
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x636efa : 0xfee75c)
    .setTitle(ended ? `🎁 Giveaway Terminé — ${g.prize}` : `🎉 GIVEAWAY — ${g.prize}`)
    .addFields(
      { name: "🏆 Gagnant(s)", value: `${g.winnersCount}`, inline: true },
      { name: "👥 Participants", value: `${g.entries.length}`, inline: true },
      { name: ended ? "⏹️ Terminé" : "⏰ Fin", value: ended ? discordTimestamp(g.endsAt, "R") : discordTimestamp(g.endsAt, "R"), inline: true },
      { name: "🎫 Organisé par", value: `<@${g.hostedById}>`, inline: true },
    )
    .setFooter({ text: ended ? "Moderax • Giveaway terminé" : "Moderax • Cliquez sur 🎉 pour participer" })
    .setTimestamp();

  if (ended && g.winners.length > 0) {
    embed.addFields({ name: "🥇 Gagnant(s)", value: g.winners.map((w) => `<@${w}>`).join(", ") });
  } else if (ended) {
    embed.addFields({ name: "❌ Aucun gagnant", value: "Pas assez de participants." });
  }

  return embed;
}

export async function endGiveaway(client: Client, giveawayId: number, force = false) {
  const g = await getGiveawayById(giveawayId);
  if (!g || g.ended) return;

  // Pick winners
  const entries = [...g.entries];
  const winners: string[] = [];
  for (let i = 0; i < Math.min(g.winnersCount, entries.length); i++) {
    const idx = Math.floor(Math.random() * entries.length);
    winners.push(entries.splice(idx, 1)[0]!);
  }

  await updateGiveaway(giveawayId, { ended: true, winners });

  // Update message
  if (g.messageId && g.channelId) {
    const guild = client.guilds.cache.find((gu) => gu.channels.cache.has(g.channelId));
    if (guild) {
      const channel = guild.channels.cache.get(g.channelId);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        const msg = await channel.messages.fetch(g.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [giveawayEmbed({ ...g, winners }, true)], components: [] }).catch(() => null);
        }
        // Announce
        if (winners.length > 0) {
          await channel.send({
            content: winners.map((w) => `<@${w}>`).join(" "),
            embeds: [successEmbed(`🎉 Félicitations !`, `${winners.map((w) => `<@${w}>`).join(", ")} a/ont gagné **${g.prize}** !`)],
          }).catch(() => null);
        } else {
          await channel.send({ embeds: [dangerEmbed("Giveaway terminé", `Pas assez de participants pour **${g.prize}**.`)] }).catch(() => null);
        }
      }
    }
  }

  timers.delete(giveawayId);
}

function scheduleGiveaway(client: Client, g: Giveaway) {
  const ms = g.endsAt.getTime() - Date.now();
  if (ms <= 0) { void endGiveaway(client, g.id); return; }
  const timer = setTimeout(() => endGiveaway(client, g.id), ms);
  timers.set(g.id, timer);
}

export async function startGiveaway(opts: {
  client: Client;
  guildId: string;
  channelId: string;
  hostedById: string;
  prize: string;
  duration: string;
  winnersCount: number;
}) {
  const ms = parseDuration(opts.duration);
  if (!ms) throw new Error("Durée invalide");
  const endsAt = new Date(Date.now() + ms);

  const g = await createGiveaway({
    guildId: opts.guildId,
    channelId: opts.channelId,
    hostedById: opts.hostedById,
    prize: opts.prize,
    winnersCount: opts.winnersCount,
    endsAt,
    entries: [],
    ended: false,
    winners: [],
  });

  const channel = opts.client.channels.cache.get(opts.channelId);
  if (!channel?.isTextBased() || channel.isDMBased()) throw new Error("Salon invalide");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`giveaway:enter:${g.id}`).setLabel("🎉 Participer").setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({ embeds: [giveawayEmbed(g)], components: [row] });
  await updateGiveaway(g.id, { messageId: msg.id });
  scheduleGiveaway(opts.client, { ...g, messageId: msg.id });
  return { giveaway: g, message: msg };
}

export async function handleGiveawayButton(interaction: ButtonInteraction) {
  const parts = interaction.customId.split(":");
  const giveawayId = parseInt(parts[2] ?? "0", 10);
  if (!giveawayId) return;

  const g = await getGiveawayById(giveawayId);
  if (!g || g.ended) {
    await interaction.reply({ embeds: [dangerEmbed("Giveaway terminé", "Ce giveaway est déjà terminé.")], ephemeral: true });
    return;
  }

  const userId = interaction.user.id;
  if (g.entries.includes(userId)) {
    // Remove entry (toggle)
    const entries = g.entries.filter((e) => e !== userId);
    await updateGiveaway(giveawayId, { entries });
    await interaction.reply({ embeds: [{ color: 0xff9f0a, description: "❌ Tu as retiré ta participation." } as never], ephemeral: true });
  } else {
    const entries = [...g.entries, userId];
    await updateGiveaway(giveawayId, { entries });
    await interaction.reply({ embeds: [{ color: 0x00d26a, description: "✅ Tu participes au giveaway ! Bonne chance 🍀" } as never], ephemeral: true });
  }

  // Update message embed count
  const msg = interaction.message;
  const updatedG = await getGiveawayById(giveawayId);
  if (updatedG && !updatedG.ended) {
    await msg.edit({ embeds: [giveawayEmbed(updatedG)] }).catch(() => null);
  }
}

export async function setupGiveaways(client: Client) {
  // Reschedule active giveaways on startup
  try {
    const active = await getActiveGiveaways();
    for (const g of active) {
      scheduleGiveaway(client, g);
    }
    logger.info(`[Giveaway] ${active.length} giveaway(s) actif(s) restauré(s)`);
  } catch (err) {
    logger.error({ err }, "[Giveaway] Erreur restauration");
  }

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith("giveaway:enter:")) {
      await handleGiveawayButton(interaction).catch((err) => logger.error({ err }, "[Giveaway] Button error"));
    }
  });
}

export { endGiveaway as forceEndGiveaway, timers as giveawayTimers };
export { parseDuration, formatDuration };
