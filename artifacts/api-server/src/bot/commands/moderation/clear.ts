import { SlashCommandBuilder, PermissionsBitField, type TextChannel } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { successEmbed, dangerEmbed } from "../../utils/embeds.js";

export const clear: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprimer des messages en masse")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addIntegerOption((o) =>
      o.setName("nombre").setDescription("Nombre de messages à supprimer (1-100)").setMinValue(1).setMaxValue(100).setRequired(true)
    )
    .addUserOption((o) => o.setName("utilisateur").setDescription("Filtrer par utilisateur (optionnel)").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageMessages, "Gérer les messages")) return;

    const amount = interaction.options.getInteger("nombre", true);
    const targetUser = interaction.options.getUser("utilisateur");
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    try {
      let messages = await channel.messages.fetch({ limit: 100 });

      // Filter by user if specified
      if (targetUser) {
        messages = messages.filter((m) => m.author.id === targetUser.id);
      }

      // Discord can only bulk-delete messages < 14 days old
      const deletable = messages.filter((m) => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000).first(amount);

      if (deletable.length === 0) {
        await interaction.editReply({ embeds: [dangerEmbed("Aucun message", "Aucun message récent à supprimer.")] });
        return;
      }

      const deleted = await channel.bulkDelete(deletable, true);

      await interaction.editReply({
        embeds: [successEmbed("Messages supprimés", `**${deleted.size}** message(s) supprimé(s)${targetUser ? ` de ${targetUser.tag}` : ""}.`)],
      });
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de supprimer les messages.")] });
    }
  },
};
