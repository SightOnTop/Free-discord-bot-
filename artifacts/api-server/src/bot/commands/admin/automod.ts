import { SlashCommandBuilder, PermissionsBitField } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { successEmbed, dangerEmbed, infoEmbed } from "../../utils/embeds.js";
import { addBadword, removeBadword, getGuildBadwords, updateGuild, getGuild } from "../../utils/dbops.js";
import { invalidateBadwordCache } from "../../systems/badwords.js";

export const automod: Command = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configurer les systèmes d'auto-modération")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommandGroup((g) =>
      g.setName("badword").setDescription("Gestion du filtre de mots interdits")
        .addSubcommand((s) =>
          s.setName("add").setDescription("Ajouter un mot interdit")
            .addStringOption((o) => o.setName("mot").setDescription("Mot à interdire").setRequired(true))
        )
        .addSubcommand((s) =>
          s.setName("remove").setDescription("Retirer un mot interdit")
            .addStringOption((o) => o.setName("mot").setDescription("Mot à retirer").setRequired(true))
        )
        .addSubcommand((s) =>
          s.setName("list").setDescription("Lister tous les mots interdits")
        )
        .addSubcommand((s) =>
          s.setName("toggle").setDescription("Activer/désactiver le filtre")
            .addBooleanOption((o) => o.setName("actif").setDescription("Activer ?").setRequired(true))
        )
    )
    .addSubcommandGroup((g) =>
      g.setName("escalation").setDescription("Escalade automatique des sanctions")
        .addSubcommand((s) =>
          s.setName("toggle").setDescription("Activer/désactiver l'escalade automatique")
            .addBooleanOption((o) => o.setName("actif").setDescription("Activer ?").setRequired(true))
        )
        .addSubcommand((s) =>
          s.setName("info").setDescription("Voir la configuration d'escalade")
        )
    ),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.Administrator, "Administrateur")) return;

    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    if (group === "badword") {
      switch (sub) {
        case "add": {
          const word = interaction.options.getString("mot", true).toLowerCase().trim();
          if (word.length < 2) { await interaction.reply({ embeds: [dangerEmbed("Trop court", "Le mot doit faire au moins 2 caractères.")], ephemeral: true }); return; }
          await interaction.deferReply({ ephemeral: true });
          await addBadword({ guildId, word, addedById: interaction.user.id });
          invalidateBadwordCache(guildId);
          await interaction.editReply({ embeds: [successEmbed("Mot interdit ajouté", `Le mot \`${word}\` a été ajouté à la liste noire.`)] });
          break;
        }
        case "remove": {
          const word = interaction.options.getString("mot", true).toLowerCase().trim();
          await interaction.deferReply({ ephemeral: true });
          await removeBadword(guildId, word);
          invalidateBadwordCache(guildId);
          await interaction.editReply({ embeds: [successEmbed("Mot retiré", `Le mot \`${word}\` a été retiré de la liste noire.`)] });
          break;
        }
        case "list": {
          await interaction.deferReply({ ephemeral: true });
          const words = await getGuildBadwords(guildId);
          if (words.length === 0) {
            await interaction.editReply({ embeds: [infoEmbed("Liste vide", "Aucun mot interdit configuré. Utilisez `/automod badword add` pour en ajouter.")] });
            return;
          }
          await interaction.editReply({
            embeds: [infoEmbed(`🔒 Mots interdits (${words.length})`, words.map((w) => `\`${w.word}\``).join(", "))],
          });
          break;
        }
        case "toggle": {
          const enabled = interaction.options.getBoolean("actif", true);
          await updateGuild(guildId, { badwordsEnabled: enabled });
          await interaction.reply({ embeds: [successEmbed(`Filtre anti-profanité ${enabled ? "activé ✅" : "désactivé ❌"}`, enabled ? "Les messages contenant des mots interdits seront automatiquement supprimés." : "Le filtre est désactivé.")], ephemeral: true });
          break;
        }
      }
    } else if (group === "escalation") {
      switch (sub) {
        case "toggle": {
          const enabled = interaction.options.getBoolean("actif", true);
          await updateGuild(guildId, { autoEscalationEnabled: enabled });
          await interaction.reply({
            embeds: [successEmbed(`Escalade automatique ${enabled ? "activée ✅" : "désactivée ❌"}`,
              enabled
                ? "**Seuils d'escalade :**\n• 3 avertissements → Timeout 1h\n• 5 avertissements → Timeout 24h\n• 7 avertissements → Ban permanent"
                : "L'escalade automatique est désactivée."
            )],
            ephemeral: true,
          });
          break;
        }
        case "info": {
          const config = await getGuild(guildId);
          await interaction.reply({
            embeds: [infoEmbed("Escalade automatique",
              `**Statut :** ${config?.autoEscalationEnabled ? "✅ Activée" : "❌ Désactivée"}\n\n` +
              "**Seuils configurés :**\n" +
              "• **3 avertissements** → Timeout 1 heure\n" +
              "• **5 avertissements** → Timeout 24 heures\n" +
              "• **7 avertissements** → Ban permanent\n\n" +
              "Ces seuils se déclenchent automatiquement lors d'un nouvel avertissement."
            )],
            ephemeral: true,
          });
          break;
        }
      }
    }
  },
};
