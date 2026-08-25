import { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, type GuildMember } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { getUserRank, getLeaderboard } from "../../utils/dbops.js";
import { levelFromXp, xpForLevel, progressBar } from "../../systems/leveling.js";
import { infoEmbed, dangerEmbed, successEmbed } from "../../utils/embeds.js";
import { db, levelsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const rank: Command = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Afficher votre rang et votre progression XP")
    .addUserOption((o) => o.setName("utilisateur").setDescription("Utilisateur (vous-même par défaut)").setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser("utilisateur") ?? interaction.user;
    await interaction.deferReply();

    const rankData = await getUserRank(interaction.guild!.id, target.id);
    if (!rankData) {
      await interaction.editReply({
        embeds: [infoEmbed("Pas de données", `**${target.username}** n'a pas encore de XP. Envoyez des messages pour commencer !`)],
      });
      return;
    }

    const currentLevel  = rankData.level;
    const currentXp     = rankData.xp;
    const xpForCurrent  = xpForLevel(currentLevel);
    const xpForNext     = xpForLevel(currentLevel + 1);
    const xpProgress    = Math.max(0, currentXp - xpForCurrent);
    const xpNeeded      = xpForNext - xpForCurrent;

    const member = interaction.guild?.members.cache.get(target.id) as GuildMember | undefined;
    const color  = member?.displayHexColor && member.displayHexColor !== "#000000"
      ? (member.displayHexColor as `#${string}`)
      : 0x636efa;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`📊 Rang de ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🏅 Rang",           value: `#${rankData.rank}`,                                                     inline: true },
        { name: "⭐ Niveau",          value: `${currentLevel}`,                                                       inline: true },
        { name: "✉️ Messages",        value: `${rankData.totalMessages.toLocaleString("fr-FR")}`,                      inline: true },
        { name: "📈 XP Total",        value: `${currentXp.toLocaleString("fr-FR")} XP`,                              inline: true },
        { name: "🎯 Prochain niveau", value: `${xpProgress.toLocaleString("fr-FR")} / ${xpNeeded.toLocaleString("fr-FR")} XP`, inline: true },
        { name: "📊 Progression",     value: `\`${progressBar(xpProgress, xpNeeded)}\` ${Math.floor((xpProgress / xpNeeded) * 100)}%` },
      )
      .setFooter({ text: "Moderax • Système de niveaux" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export const leaderboard: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Afficher le classement XP du serveur")
    .addIntegerOption((o) =>
      o.setName("limite").setDescription("Nombre d'entrées (5-20, défaut 10)").setMinValue(5).setMaxValue(20).setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const limit = interaction.options.getInteger("limite") ?? 10;
    const entries = await getLeaderboard(interaction.guild!.id, limit);

    if (entries.length === 0) {
      await interaction.editReply({ embeds: [infoEmbed("Classement vide", "Personne n'a encore de XP sur ce serveur.")] });
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const lines = entries.map((e, i) => {
      const medal  = medals[i] ?? `**${i + 1}.**`;
      const member = interaction.guild?.members.cache.get(e.userId);
      const name   = member?.user.username ?? `Utilisateur inconnu`;
      return `${medal} **${name}** — Nv. ${e.level} · ${e.xp.toLocaleString("fr-FR")} XP`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x0d0d0d)
      .setTitle(`🏆 Classement XP — ${interaction.guild!.name}`)
      .setDescription(lines.join("\n"))
      .setThumbnail(interaction.guild!.iconURL())
      .setFooter({ text: `Moderax • Top ${limit} | ${entries.length} joueur(s)` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export const resetLevel: Command = {
  data: new SlashCommandBuilder()
    .setName("resetlevel")
    .setDescription("Réinitialiser le niveau XP d'un utilisateur (admin)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Utilisateur à réinitialiser").setRequired(true)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.Administrator, "Administrateur")) return;

    const target = interaction.options.getUser("utilisateur", true);
    await interaction.deferReply({ ephemeral: true });

    await db
      .delete(levelsTable)
      .where(and(eq(levelsTable.guildId, interaction.guild!.id), eq(levelsTable.userId, target.id)));

    await interaction.editReply({
      embeds: [successEmbed("Niveau réinitialisé", `Le niveau et l'XP de **${target.username}** ont été remis à zéro.`)],
    });
  },
};
