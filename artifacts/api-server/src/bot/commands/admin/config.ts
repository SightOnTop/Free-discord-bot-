import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { getGuild } from "../../utils/dbops.js";
import { infoEmbed } from "../../utils/embeds.js";

function fmtChannel(id: string | null | undefined): string {
  return id ? `<#${id}>` : "❌ Non configuré";
}

function fmtRole(id: string | null | undefined): string {
  return id ? `<@&${id}>` : "❌ Non configuré";
}

function fmtBool(val: boolean | null | undefined): string {
  return val ? "✅ Activé" : "❌ Désactivé";
}

export const config: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Afficher la configuration actuelle de Moderax")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.Administrator, "Administrateur")) return;
    await interaction.deferReply({ ephemeral: true });

    const g = await getGuild(interaction.guild!.id);

    if (!g) {
      await interaction.editReply({
        embeds: [infoEmbed("Configuration vide", "Aucune configuration trouvée. Utilisez `/set` pour configurer Moderax.")],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0d0d0d)
      .setTitle("⚙️ Configuration Moderax")
      .setThumbnail(interaction.client.user!.displayAvatarURL())
      .addFields(
        // Roles
        { name: "🔇 Rôle Mute",     value: fmtRole(g.muteRoleId),    inline: true },
        { name: "🎭 Autorole",       value: fmtRole(g.autoRoleId),    inline: true },
        { name: "🎟️ Rôle Captcha",  value: fmtRole(g.captchaRoleId), inline: true },
        // Channels
        { name: "📋 Logs Modération",value: fmtChannel(g.logChannelId),        inline: true },
        { name: "👋 Bienvenue",       value: fmtChannel(g.welcomeChannelId),    inline: true },
        { name: "📡 Captcha",         value: fmtChannel(g.captchaChannelId),    inline: true },
        { name: "📁 Logs Tickets",    value: fmtChannel(g.ticketLogChannelId),  inline: true },
        { name: "💡 Suggestions",     value: fmtChannel(g.suggestionChannelId), inline: true },
        { name: "🚨 Signalements",    value: fmtChannel(g.reportChannelId),     inline: true },
        // Ticket category
        { name: "🎫 Catégorie Tickets", value: g.ticketCategoryId ? `\`${g.ticketCategoryId}\`` : "❌ Non configuré", inline: true },
        // Toggles
        { name: "🔐 Captcha",           value: fmtBool(g.captchaEnabled),          inline: true },
        { name: "🛡️ Anti-Nuke",         value: fmtBool(g.antiNukeEnabled),         inline: true },
        { name: "🚫 Anti-Spam",          value: fmtBool(g.antiSpamEnabled),         inline: true },
        { name: "🔒 Filtre profanité",   value: fmtBool(g.badwordsEnabled),         inline: true },
        { name: "⚡ Auto-escalade",       value: fmtBool(g.autoEscalationEnabled),  inline: true },
      )
      .setFooter({ text: "Moderax • Utilisez /set pour modifier la configuration" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
