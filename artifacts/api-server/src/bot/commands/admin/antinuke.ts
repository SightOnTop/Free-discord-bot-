import { SlashCommandBuilder, PermissionsBitField } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { successEmbed, infoEmbed } from "../../utils/embeds.js";
import { getGuild, upsertGuild, updateGuild } from "../../utils/dbops.js";

export const antinuke: Command = {
  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Configurer l'Anti-Nuke de Moderax")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand((s) =>
      s.setName("enable").setDescription("Activer l'Anti-Nuke")
    )
    .addSubcommand((s) =>
      s.setName("disable").setDescription("Désactiver l'Anti-Nuke")
    )
    .addSubcommand((s) =>
      s.setName("status").setDescription("Voir le statut de l'Anti-Nuke")
    ),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.Administrator, "Administrateur")) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    const existing = await getGuild(guildId);
    if (!existing) await upsertGuild({ guildId });

    await interaction.deferReply({ ephemeral: true });

    switch (sub) {
      case "enable":
        await updateGuild(guildId, { antiNukeEnabled: true });
        await interaction.editReply({
          embeds: [successEmbed("Anti-Nuke activé ✅",
            "L'Anti-Nuke est maintenant actif.\n\n" +
            "**Protections activées :**\n" +
            "• Mass-ban (≥3 bans en 10s)\n" +
            "• Mass-kick (≥3 kicks en 10s)\n" +
            "• Suppression massive de salons (≥3 en 10s)\n" +
            "• Suppression massive de rôles (≥3 en 10s)\n" +
            "• Création massive de webhooks (≥5 en 10s)\n\n" +
            "⚠️ L'attaquant est automatiquement banni."
          )],
        });
        break;

      case "disable":
        await updateGuild(guildId, { antiNukeEnabled: false });
        await interaction.editReply({
          embeds: [successEmbed("Anti-Nuke désactivé ❌", "L'Anti-Nuke a été désactivé. Le serveur n'est plus protégé contre les attaques en masse.")],
        });
        break;

      case "status": {
        const config = await getGuild(guildId);
        await interaction.editReply({
          embeds: [infoEmbed("Statut Anti-Nuke",
            `**État :** ${config?.antiNukeEnabled ? "✅ Actif" : "❌ Inactif"}\n\n` +
            "**Seuils de déclenchement :**\n" +
            "• Bans en masse : ≥ 3 en 10s\n" +
            "• Kicks en masse : ≥ 3 en 10s\n" +
            "• Suppressions de salons : ≥ 3 en 10s\n" +
            "• Suppressions de rôles : ≥ 3 en 10s\n" +
            "• Créations de webhooks : ≥ 5 en 10s"
          )],
        });
        break;
      }
    }
  },
};
