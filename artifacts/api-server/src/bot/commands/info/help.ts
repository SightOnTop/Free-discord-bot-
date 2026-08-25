import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../types.js";

export const help: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Afficher toutes les commandes Moderax"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x0d0d0d)
      .setTitle("🛡️ MODERAX — Aide complète")
      .setThumbnail(interaction.client.user!.displayAvatarURL())
      .addFields(
        {
          name: "⚔️ Modération",
          value: [
            "`/ban` `/unban` `/kick` `/softban`",
            "`/mute` `/unmute` `/timeout` `/untimeout`",
            "`/warn` `/warnings` `/clearwarn` `/clearwarns`",
            "`/clear` `/purge` — Nettoyage de messages",
          ].join("\n"),
          inline: false,
        },
        {
          name: "🔒 Gestion des salons",
          value: "`/lock` `/unlock` `/slowmode` `/nuke`",
          inline: false,
        },
        {
          name: "🤖 Systèmes automatiques",
          value: [
            "🛡️ **Anti-Nuke** — Protection contre les attaques en masse",
            "🚫 **Anti-Spam** — Détection flood & messages répétitifs",
            "🔒 **Filtre profanité** — Suppression automatique de mots interdits",
            "⚡ **Auto-escalade** — Sanctions automatiques selon les avertissements",
          ].join("\n"),
          inline: false,
        },
        {
          name: "🎫 Tickets & Signalements",
          value: "`/ticket create/add/remove` `/report`",
          inline: false,
        },
        {
          name: "🎉 Communauté",
          value: "`/giveaway` `/poll` `/announce` `/suggest` `/remind`",
          inline: false,
        },
        {
          name: "⭐ Niveaux & XP",
          value: "`/rank` `/leaderboard` `/resetlevel`",
          inline: false,
        },
        {
          name: "🎮 Fun",
          value: "`/8ball` `/dice` `/coinflip` `/choose` `/avatar` `/rps` `/calc`",
          inline: false,
        },
        {
          name: "⚙️ Configuration (Admin)",
          value: [
            "`/set` — Configurer Moderax (rôles, salons, captcha...)",
            "`/config` — Voir la configuration actuelle",
            "`/antinuke` — Gérer l'Anti-Nuke",
            "`/automod` — Gérer le filtre & l'auto-escalade",
            "`/temprole` — Rôle temporaire",
          ].join("\n"),
          inline: false,
        },
        {
          name: "ℹ️ Informations",
          value: "`/userinfo` `/serverinfo` `/botinfo`",
          inline: false,
        },
      )
      .setFooter({ text: "Moderax — PROTÉGER | MODÉRER | SÉCURISER" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
