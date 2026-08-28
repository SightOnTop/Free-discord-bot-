import {
  SlashCommandBuilder, PermissionsBitField,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, type ButtonInteraction, type Client,
} from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { dangerEmbed, successEmbed } from "../../utils/embeds.js";
import {
  createPoll, updatePoll, deletePoll, getPollByMessageId, getActivePolls,
  getPollVote, recordPollVote, getPollVoteCounts,
} from "../../utils/dbops.js";
import { MAX_TIMEOUT_MS } from "../../utils/time.js";

const OPTION_EMOJIS = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];
const pollTimers = new Map<number, NodeJS.Timeout>();

async function closePoll(client: Client, record: import("@workspace/db").Poll) {
  if (record.closed) return;
  await updatePoll(record.id, { closed: true });
  pollTimers.delete(record.id);
  if (!record.messageId) return;
  const channel = client.channels.cache.get(record.channelId);
  if (!channel?.isTextBased() || channel.isDMBased()) return;
  const message = await channel.messages.fetch(record.messageId).catch(() => null);
  if (message) await message.edit({ components: [] }).catch(() => null);
}


function schedulePoll(client: Client, record: import("@workspace/db").Poll) {
  const remaining = record.endsAt.getTime() - Date.now();
  if (remaining <= 0) {
    void closePoll(client, record).catch(() => null);
    return;
  }
  const timer = setTimeout(() => {
    const left = record.endsAt.getTime() - Date.now();
    if (left > 0) schedulePoll(client, record);
    else void closePoll(client, record).catch(() => null);
  }, Math.min(remaining, MAX_TIMEOUT_MS));
  pollTimers.set(record.id, timer);
}


export async function handlePollVote(interaction: ButtonInteraction) {
  const parts = interaction.customId.split(":");
  const pollId = parseInt(parts[1] ?? "0", 10);
  const optionIndex = parseInt(parts[2] ?? "-1", 10);
  if (!pollId || optionIndex < 0) return;

  const record = await getPollByMessageId(interaction.message.id);
  if (!record || record.id !== pollId || optionIndex >= record.options.length) {
    await interaction.reply({ embeds: [dangerEmbed("Sondage introuvable", "Ce sondage n’est plus disponible.")], ephemeral: true });
    return;
  }
  if (record.closed || record.endsAt.getTime() <= Date.now()) {
    await closePoll(interaction.client, record);
    await interaction.reply({ embeds: [dangerEmbed("Sondage terminé", "La période de vote est terminée.")], ephemeral: true });
    return;
  }

  const previous = await getPollVote(record.id, interaction.user.id);
  if (previous?.optionIndex === optionIndex) {
    await interaction.reply({ content: "⚠️ Vous avez déjà voté pour cette option.", ephemeral: true });
    return;
  }
  await recordPollVote({ pollId: record.id, userId: interaction.user.id, optionIndex });
  const rows = await getPollVoteCounts(record.id);
  const counts = new Array(record.options.length).fill(0);
  for (const row of rows) counts[row.optionIndex] = row.count;
  const baseEmbed = interaction.message.embeds[0];
  const updatedEmbed = baseEmbed ? EmbedBuilder.from(baseEmbed)
    .setDescription(record.options.map((option, index) => `${OPTION_EMOJIS[index]} **${option}** — ${counts[index]} vote(s)`).join("\n\n"))
    .setFooter({ text: `Moderax • ${counts.reduce((sum, count) => sum + count, 0)} participant(s)` }) : null;
  if (updatedEmbed) await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => null);
  await interaction.reply({ content: `✅ Vote pour **${record.options[optionIndex]}** enregistré !`, ephemeral: true });
}

export async function setupPolls(client: Client) {
  const active = await getActivePolls();
  for (const record of active) schedulePoll(client, record);
}

export const poll: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Créer un sondage interactif")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addStringOption((o) => o.setName("question").setDescription("Question du sondage").setRequired(true))
    .addStringOption((o) => o.setName("option1").setDescription("Option 1").setRequired(true))
    .addStringOption((o) => o.setName("option2").setDescription("Option 2").setRequired(true))
    .addStringOption((o) => o.setName("option3").setDescription("Option 3").setRequired(false))
    .addStringOption((o) => o.setName("option4").setDescription("Option 4").setRequired(false))
    .addStringOption((o) => o.setName("option5").setDescription("Option 5").setRequired(false))
    .addChannelOption((o) =>
      o.setName("salon").setDescription("Salon cible (actuel par défaut)").addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageMessages, "Gérer les messages")) return;

    const question = interaction.options.getString("question", true);
    const options: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const opt = interaction.options.getString(`option${i}`);
      if (opt) options.push(opt);
    }

    if (options.length < 2) {
      await interaction.reply({ embeds: [dangerEmbed("Erreur", "Minimum 2 options requises.")], ephemeral: true });
      return;
    }

    const targetOpt = interaction.options.getChannel("salon") ?? interaction.channel;
    const channel = interaction.client.channels.cache.get(targetOpt!.id);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ embeds: [dangerEmbed("Erreur", "Salon invalide.")], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const record = await createPoll({
      guildId: interaction.guild!.id,
      channelId: channel.id,
      question,
      options,
      createdById: interaction.user.id,
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      closed: false,
    });

    const embed = new EmbedBuilder()
      .setColor(0x636efa)
      .setTitle(`📊 Sondage : ${question}`)
      .setDescription(options.map((opt, i) => `${OPTION_EMOJIS[i]} **${opt}**`).join("\n\n"))
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setFooter({ text: "Moderax • Sondage — Cliquez pour voter" })
      .setTimestamp();

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();
    options.forEach((opt, i) => {
      if (i > 0 && i % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
      }
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll:${record.id}:${i}`)
          .setLabel(opt.slice(0, 80))
          .setEmoji(OPTION_EMOJIS[i]!)
          .setStyle(ButtonStyle.Secondary),
      );
    });
    rows.push(currentRow);

    const msg = await channel.send({ embeds: [embed], components: rows });
    await interaction.editReply({ embeds: [successEmbed("Sondage créé", `Sondage envoyé dans ${channel}.`)] });

    try {
      await updatePoll(record.id, { messageId: msg.id });
      schedulePoll(interaction.client, { ...record, messageId: msg.id });
    } catch (err) {
      await deletePoll(record.id).catch(() => null);
      throw err;
    }
  },
};

export const announce: Command = {
  data: new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Créer une annonce stylisée")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption((o) => o.setName("titre").setDescription("Titre de l'annonce").setRequired(true))
    .addStringOption((o) => o.setName("message").setDescription("Corps de l'annonce").setRequired(true))
    .addChannelOption((o) =>
      o.setName("salon").setDescription("Salon cible (actuel par défaut)").addChannelTypes(ChannelType.GuildText).setRequired(false)
    )
    .addStringOption((o) => o.setName("couleur").setDescription("Couleur HEX (ex: #FF5733)").setRequired(false))
    .addBooleanOption((o) => o.setName("mention_everyone").setDescription("Mentionner @everyone ?").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageGuild, "Gérer le serveur")) return;

    const title    = interaction.options.getString("titre", true);
    const message  = interaction.options.getString("message", true);
    const colorStr = interaction.options.getString("couleur") ?? "#0d0d0d";
    const mention  = interaction.options.getBoolean("mention_everyone") ?? false;
    const colorNum = parseInt(colorStr.replace("#", ""), 16) || 0x0d0d0d;

    const targetOpt = interaction.options.getChannel("salon") ?? interaction.channel;
    const channel   = interaction.client.channels.cache.get(targetOpt!.id);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ embeds: [dangerEmbed("Erreur", "Salon invalide.")], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(colorNum)
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setAuthor({ name: interaction.guild!.name, iconURL: interaction.guild!.iconURL() ?? undefined })
      .setFooter({ text: `Annoncé par ${interaction.user.username} • Moderax` })
      .setTimestamp();

    await channel.send({ content: mention ? "@everyone" : undefined, embeds: [embed] });
    await interaction.editReply({ embeds: [successEmbed("Annonce envoyée", `Annonce publiée dans ${channel}.`)] });
  },
};
