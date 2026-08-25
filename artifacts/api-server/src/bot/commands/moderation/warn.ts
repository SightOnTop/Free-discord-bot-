import { SlashCommandBuilder, PermissionsBitField, type GuildMember, EmbedBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { successEmbed, dangerEmbed, infoEmbed } from "../../utils/embeds.js";
import { addWarning, getUserWarnings, deleteWarning, clearUserWarnings, getGuild } from "../../utils/dbops.js";
import { checkEscalation } from "../../systems/autoEscalation.js";
import { discordTimestamp } from "../../utils/time.js";

export const warn: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Avertir un membre")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre à avertir").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison de l'avertissement").setRequired(true)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ModerateMembers, "Modérer des membres")) return;
    const target = interaction.options.getUser("utilisateur", true);
    const reason = interaction.options.getString("raison", true);

    if (target.id === interaction.user.id) {
      await interaction.reply({ embeds: [dangerEmbed("Interdit", "Vous ne pouvez pas vous avertir vous-même.")], ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const warning = await addWarning({
      guildId: interaction.guild!.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });
    const warnings = await getUserWarnings(interaction.guild!.id, target.id);

    const embed = successEmbed(
      "Avertissement enregistré",
      `${target} a reçu l'avertissement **#${warning.id}**.\n**Raison :** ${reason}\n**Total :** ${warnings.length} avertissement(s)`
    );
    await interaction.editReply({ embeds: [embed] });

    // Log
    const config = await getGuild(interaction.guild!.id);
    if (config?.logChannelId) {
      const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
      if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
    }

    // DM target
    await target.send({
      embeds: [dangerEmbed(`⚠️ Avertissement — ${interaction.guild!.name}`,
        `Vous avez reçu un avertissement.\n**Raison :** ${reason}\n**Total :** ${warnings.length} avertissement(s)`
      )],
    }).catch(() => null);

    // Check auto-escalation
    await checkEscalation(interaction.guild!, target.id, reason).catch(() => null);
  },
};

export const warnings: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Voir les avertissements d'un membre")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre").setRequired(true)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ModerateMembers, "Modérer des membres")) return;
    const target = interaction.options.getUser("utilisateur", true);
    await interaction.deferReply({ ephemeral: true });

    const warns = await getUserWarnings(interaction.guild!.id, target.id);
    if (warns.length === 0) {
      await interaction.editReply({ embeds: [infoEmbed("Aucun avertissement", `${target.tag} n'a aucun avertissement.`)] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff9f0a)
      .setTitle(`⚠️ Avertissements de ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(
        warns.slice(0, 10).map((w) =>
          `**#${w.id}** — <@${w.moderatorId}> • ${discordTimestamp(w.createdAt)}\n> ${w.reason}`
        ).join("\n\n")
      )
      .setFooter({ text: `${warns.length} avertissement(s) au total | Moderax` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export const clearwarn: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarn")
    .setDescription("Supprimer un avertissement par son ID")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addIntegerOption((o) => o.setName("id").setDescription("ID de l'avertissement").setRequired(true)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ModerateMembers, "Modérer des membres")) return;
    const id = interaction.options.getInteger("id", true);
    await deleteWarning(id);
    await interaction.reply({ embeds: [successEmbed("Avertissement supprimé", `L'avertissement **#${id}** a été supprimé.`)], ephemeral: true });
  },
};

export const clearwarns: Command = {
  data: new SlashCommandBuilder()
    .setName("clearwarns")
    .setDescription("Supprimer tous les avertissements d'un membre")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre").setRequired(true)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ModerateMembers, "Modérer des membres")) return;
    const target = interaction.options.getUser("utilisateur", true);
    await clearUserWarnings(interaction.guild!.id, target.id);
    await interaction.reply({
      embeds: [successEmbed("Avertissements effacés", `Tous les avertissements de ${target.tag} ont été supprimés.`)],
      ephemeral: true,
    });
  },
};
