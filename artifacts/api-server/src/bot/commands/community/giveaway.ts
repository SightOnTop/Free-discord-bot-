import { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { successEmbed, dangerEmbed, infoEmbed } from "../../utils/embeds.js";
import { startGiveaway, endGiveaway } from "../../systems/giveaway.js";
import { getGiveawayById, updateGiveaway } from "../../utils/dbops.js";

export const giveaway: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Gérer les giveaways")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand((s) =>
      s.setName("start").setDescription("Lancer un giveaway")
        .addStringOption((o) => o.setName("duree").setDescription("Durée: 10m, 1h, 2d").setRequired(true))
        .addStringOption((o) => o.setName("prix").setDescription("Prix à gagner").setRequired(true))
        .addIntegerOption((o) => o.setName("gagnants").setDescription("Nombre de gagnants (défaut 1)").setMinValue(1).setMaxValue(20).setRequired(false))
        .addChannelOption((o) => o.setName("salon").setDescription("Salon du giveaway (actuel par défaut)").addChannelTypes(ChannelType.GuildText).setRequired(false))
    )
    .addSubcommand((s) =>
      s.setName("end").setDescription("Terminer un giveaway manuellement")
        .addIntegerOption((o) => o.setName("id").setDescription("ID du giveaway").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("reroll").setDescription("Re-tirer un gagnant")
        .addIntegerOption((o) => o.setName("id").setDescription("ID du giveaway").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("info").setDescription("Voir les informations d'un giveaway")
        .addIntegerOption((o) => o.setName("id").setDescription("ID du giveaway").setRequired(true))
    ),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageGuild, "Gérer le serveur")) return;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "start": {
        const duration = interaction.options.getString("duree", true);
        const prize = interaction.options.getString("prix", true);
        const winnersCount = interaction.options.getInteger("gagnants") ?? 1;
        const channel = interaction.options.getChannel("salon") ?? interaction.channel;

        await interaction.deferReply({ ephemeral: true });

        try {
          const { giveaway: g } = await startGiveaway({
            client: interaction.client,
            guildId: interaction.guild!.id,
            channelId: channel!.id,
            hostedById: interaction.user.id,
            prize,
            duration,
            winnersCount,
          });
          await interaction.editReply({ embeds: [successEmbed("Giveaway lancé ! 🎉", `**Giveaway #${g.id}** créé dans <#${channel!.id}> pour **${prize}**.`)] });
        } catch (err) {
          await interaction.editReply({ embeds: [dangerEmbed("Erreur", err instanceof Error ? err.message : "Impossible de créer le giveaway.")] });
        }
        break;
      }

      case "end": {
        const id = interaction.options.getInteger("id", true);
        await interaction.deferReply({ ephemeral: true });
        const g = await getGiveawayById(id);
        if (!g || g.ended) {
          await interaction.editReply({ embeds: [dangerEmbed("Introuvable", "Giveaway introuvable ou déjà terminé.")] });
          return;
        }
        await endGiveaway(interaction.client, id, true);
        await interaction.editReply({ embeds: [successEmbed("Giveaway terminé", `Giveaway #${id} terminé.`)] });
        break;
      }

      case "reroll": {
        const id = interaction.options.getInteger("id", true);
        await interaction.deferReply({ ephemeral: true });
        const g = await getGiveawayById(id);
        if (!g || !g.ended) {
          await interaction.editReply({ embeds: [dangerEmbed("Introuvable", "Giveaway introuvable ou pas encore terminé.")] });
          return;
        }
        if (g.entries.length === 0) {
          await interaction.editReply({ embeds: [dangerEmbed("Pas de participants", "Aucun participant pour re-tirer.")] });
          return;
        }
        const newWinner = g.entries[Math.floor(Math.random() * g.entries.length)]!;
        await updateGiveaway(id, { winners: [...g.winners, newWinner] });
        const channel = interaction.client.channels.cache.get(g.channelId);
        if (channel?.isTextBased() && !channel.isDMBased()) {
          await channel.send({ content: `<@${newWinner}>`, embeds: [successEmbed("🎉 Re-tirage !", `<@${newWinner}> a gagné **${g.prize}** !`)] });
        }
        await interaction.editReply({ embeds: [successEmbed("Re-tirage effectué", `Nouveau gagnant : <@${newWinner}>`)] });
        break;
      }

      case "info": {
        const id = interaction.options.getInteger("id", true);
        await interaction.deferReply({ ephemeral: true });
        const g = await getGiveawayById(id);
        if (!g) {
          await interaction.editReply({ embeds: [dangerEmbed("Introuvable", "Giveaway #" + id + " introuvable.")] });
          return;
        }
        const embed = new EmbedBuilder()
          .setColor(g.ended ? 0x636efa : 0xfee75c)
          .setTitle(`🎁 Giveaway #${g.id} — ${g.prize}`)
          .addFields(
            { name: "Statut", value: g.ended ? "✅ Terminé" : "🟢 En cours", inline: true },
            { name: "Participants", value: `${g.entries.length}`, inline: true },
            { name: "Gagnants requis", value: `${g.winnersCount}`, inline: true },
            { name: "Organisé par", value: `<@${g.hostedById}>`, inline: true },
            { name: "Salon", value: `<#${g.channelId}>`, inline: true },
          )
          .setFooter({ text: "Moderax • Giveaway" }).setTimestamp();
        if (g.winners.length > 0) embed.addFields({ name: "Gagnant(s)", value: g.winners.map((w) => `<@${w}>`).join(", ") });
        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  },
};
