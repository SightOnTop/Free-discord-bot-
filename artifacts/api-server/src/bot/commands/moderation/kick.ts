import { SlashCommandBuilder, PermissionsBitField, type GuildMember } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, canModerate, Perms } from "../../utils/permissions.js";
import { modActionEmbed, dangerEmbed, Colors } from "../../utils/embeds.js";
import { addModlog, getGuild } from "../../utils/dbops.js";

export const kick: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulser un membre du serveur")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre à expulser").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison de l'expulsion").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.KickMembers, "Expulser des membres")) return;

    const target = interaction.options.getMember("utilisateur") as GuildMember | null;
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!target) {
      await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Ce membre n'est pas sur le serveur.")], ephemeral: true });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({ embeds: [dangerEmbed("Interdit", "Vous ne pouvez pas vous expulser vous-même.")], ephemeral: true });
      return;
    }

    if (!canModerate(interaction.member as GuildMember, target)) {
      await interaction.reply({ embeds: [dangerEmbed("Impossible", "Vous ne pouvez pas modérer cet utilisateur.")], ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const user = target.user;
      await target.kick(`${interaction.user.username}: ${reason}`);
      await addModlog({ guildId: interaction.guild!.id, userId: user.id, moderatorId: interaction.user.id, action: "kick", reason });

      const embed = modActionEmbed({
        action: "Membre Expulsé",
        target: `${user.username} (\`${user.id}\`)`,
        moderator: interaction.user.username,
        reason,
        color: Colors.warning,
        emoji: "👢",
      });

      await interaction.editReply({ embeds: [embed] });

      const config = await getGuild(interaction.guild!.id);
      if (config?.logChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible d'expulser cet utilisateur.")] });
    }
  },
};
