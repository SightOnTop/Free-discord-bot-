import {
  SlashCommandBuilder, PermissionsBitField,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType,
} from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { dangerEmbed, successEmbed } from "../../utils/embeds.js";

const OPTION_EMOJIS = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯"];

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
          .setCustomId(`poll:${i}`)
          .setLabel(opt.slice(0, 80))
          .setEmoji(OPTION_EMOJIS[i]!)
          .setStyle(ButtonStyle.Secondary),
      );
    });
    rows.push(currentRow);

    const msg = await channel.send({ embeds: [embed], components: rows });
    await interaction.editReply({ embeds: [successEmbed("Sondage créé", `Sondage envoyé dans ${channel}.`)] });

    // In-memory vote tracking (per session, one vote per user)
    const votes  = new Map<string, number>();  // userId → optionIndex
    const counts = new Array<number>(options.length).fill(0);

    const collector = msg.createMessageComponentCollector({ time: 7 * 24 * 60 * 60 * 1_000 });
    collector.on("collect", async (btn) => {
      if (!btn.isButton()) return;
      const optIdx = parseInt(btn.customId.split(":")[1] ?? "0", 10);
      if (isNaN(optIdx) || optIdx >= options.length) return;

      const prev = votes.get(btn.user.id);
      if (prev !== undefined) {
        if (prev === optIdx) {
          await btn.reply({ content: "⚠️ Vous avez déjà voté pour cette option.", ephemeral: true });
          return;
        }
        counts[prev]!--;
      }
      votes.set(btn.user.id, optIdx);
      counts[optIdx]!++;

      const updatedEmbed = EmbedBuilder.from(embed)
        .setDescription(options.map((opt, i) => `${OPTION_EMOJIS[i]} **${opt}** — ${counts[i]} vote(s)`).join("\n\n"))
        .setFooter({ text: `Moderax • ${votes.size} participant(s)` });

      await msg.edit({ embeds: [updatedEmbed] });
      await btn.reply({ content: `✅ Vote pour **${options[optIdx]}** enregistré !`, ephemeral: true });
    });
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
