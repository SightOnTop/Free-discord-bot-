import { SlashCommandBuilder, PermissionsBitField, type GuildMember } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, canModerate, Perms } from "../../utils/permissions.js";
import { modActionEmbed, dangerEmbed, Colors } from "../../utils/embeds.js";
import { addModlog, getGuild } from "../../utils/dbops.js";

export const ban: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannir un membre du serveur")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre à bannir").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison du ban").setRequired(false))
    .addIntegerOption((o) =>
      o.setName("supprimer_messages").setDescription("Jours de messages à supprimer (0-7)").setMinValue(0).setMaxValue(7).setRequired(false)
    ),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.BanMembers, "Bannir des membres")) return;

    const target = interaction.options.getUser("utilisateur", true);
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";
    const deleteMessageSeconds = (interaction.options.getInteger("supprimer_messages") ?? 0) * 86_400;

    if (target.id === interaction.user.id) {
      await interaction.reply({ embeds: [dangerEmbed("Interdit", "Vous ne pouvez pas vous bannir vous-même.")], ephemeral: true });
      return;
    }

    const guild = interaction.guild!;
    const member = guild.members.cache.get(target.id) as GuildMember | undefined;
    if (member && !canModerate(interaction.member as GuildMember, member)) {
      await interaction.reply({ embeds: [dangerEmbed("Impossible", "Vous ne pouvez pas modérer cet utilisateur (hiérarchie insuffisante).")], ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      await guild.members.ban(target, { reason: `${interaction.user.username}: ${reason}`, deleteMessageSeconds });
      await addModlog({ guildId: guild.id, userId: target.id, moderatorId: interaction.user.id, action: "ban", reason });

      const embed = modActionEmbed({
        action: "Membre Banni",
        target: `${target.username} (\`${target.id}\`)`,
        moderator: interaction.user.username,
        reason,
        color: Colors.danger,
        emoji: "🔨",
      });

      await interaction.editReply({ embeds: [embed] });

      const config = await getGuild(guild.id);
      if (config?.logChannelId) {
        const logChannel = guild.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de bannir cet utilisateur. Vérifiez mes permissions et la hiérarchie.")] });
    }
  },
};
