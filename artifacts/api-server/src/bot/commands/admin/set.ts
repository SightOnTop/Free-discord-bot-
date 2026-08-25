import { SlashCommandBuilder, PermissionsBitField, ChannelType } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { successEmbed, dangerEmbed } from "../../utils/embeds.js";
import { getGuild, upsertGuild, updateGuild } from "../../utils/dbops.js";

export const set: Command = {
  data: new SlashCommandBuilder()
    .setName("set")
    .setDescription("Configurer Moderax pour ce serveur")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand((s) =>
      s.setName("muterole").setDescription("Définir le rôle mute")
        .addRoleOption((o) => o.setName("role").setDescription("Rôle mute").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("autorole").setDescription("Définir le rôle automatique à l'arrivée")
        .addRoleOption((o) => o.setName("role").setDescription("Rôle à donner automatiquement").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("logchannel").setDescription("Définir le salon de logs de modération")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon logs").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("welcomechannel").setDescription("Définir le salon de bienvenue")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon bienvenue").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("ticketcategory").setDescription("Définir la catégorie pour les tickets")
        .addChannelOption((o) => o.setName("categorie").setDescription("Catégorie tickets").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("ticketlogchannel").setDescription("Définir le salon de logs des tickets")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon logs tickets").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("captcha").setDescription("Activer/désactiver le captcha à l'arrivée")
        .addBooleanOption((o) => o.setName("actif").setDescription("Activer le captcha ?").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("captcharole").setDescription("Rôle donné après validation du captcha")
        .addRoleOption((o) => o.setName("role").setDescription("Rôle post-captcha").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("captchachannel").setDescription("Salon où s'affiche le captcha")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon captcha").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("antispam").setDescription("Activer/désactiver l'anti-spam")
        .addBooleanOption((o) => o.setName("actif").setDescription("Activer l'anti-spam ?").setRequired(true))
    ),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.Administrator, "Administrateur")) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    // Ensure guild row exists
    const existing = await getGuild(guildId);
    if (!existing) await upsertGuild({ guildId });

    await interaction.deferReply({ ephemeral: true });

    switch (sub) {
      case "muterole": {
        const role = interaction.options.getRole("role", true);
        await updateGuild(guildId, { muteRoleId: role.id });
        await interaction.editReply({ embeds: [successEmbed("Rôle mute configuré", `Rôle mute → ${role}`)] });
        break;
      }
      case "autorole": {
        const role = interaction.options.getRole("role", true);
        await updateGuild(guildId, { autoRoleId: role.id });
        await interaction.editReply({ embeds: [successEmbed("Autorole configuré", `Rôle automatique → ${role}`)] });
        break;
      }
      case "logchannel": {
        const channel = interaction.options.getChannel("salon", true);
        await updateGuild(guildId, { logChannelId: channel.id });
        await interaction.editReply({ embeds: [successEmbed("Salon logs configuré", `Logs → ${channel}`)] });
        break;
      }
      case "welcomechannel": {
        const channel = interaction.options.getChannel("salon", true);
        await updateGuild(guildId, { welcomeChannelId: channel.id });
        await interaction.editReply({ embeds: [successEmbed("Salon bienvenue configuré", `Bienvenue → ${channel}`)] });
        break;
      }
      case "ticketcategory": {
        const cat = interaction.options.getChannel("categorie", true);
        await updateGuild(guildId, { ticketCategoryId: cat.id });
        await interaction.editReply({ embeds: [successEmbed("Catégorie tickets configurée", `Tickets → ${cat.name}`)] });
        break;
      }
      case "ticketlogchannel": {
        const channel = interaction.options.getChannel("salon", true);
        await updateGuild(guildId, { ticketLogChannelId: channel.id });
        await interaction.editReply({ embeds: [successEmbed("Logs tickets configurés", `Logs tickets → ${channel}`)] });
        break;
      }
      case "captcha": {
        const enabled = interaction.options.getBoolean("actif", true);
        await updateGuild(guildId, { captchaEnabled: enabled });
        await interaction.editReply({ embeds: [successEmbed("Captcha " + (enabled ? "activé ✅" : "désactivé ❌"), enabled ? "Les nouveaux membres devront résoudre un captcha." : "Le captcha est désactivé.")] });
        break;
      }
      case "captcharole": {
        const role = interaction.options.getRole("role", true);
        await updateGuild(guildId, { captchaRoleId: role.id });
        await interaction.editReply({ embeds: [successEmbed("Rôle captcha configuré", `Rôle après captcha → ${role}`)] });
        break;
      }
      case "captchachannel": {
        const channel = interaction.options.getChannel("salon", true);
        await updateGuild(guildId, { captchaChannelId: channel.id });
        await interaction.editReply({ embeds: [successEmbed("Salon captcha configuré", `Captcha → ${channel}`)] });
        break;
      }
      case "antispam": {
        const enabled = interaction.options.getBoolean("actif", true);
        await updateGuild(guildId, { antiSpamEnabled: enabled });
        await interaction.editReply({ embeds: [successEmbed("Anti-spam " + (enabled ? "activé ✅" : "désactivé ❌"), "")] });
        break;
      }
      default:
        await interaction.editReply({ embeds: [dangerEmbed("Sous-commande inconnue", "")] });
    }
  },
};
