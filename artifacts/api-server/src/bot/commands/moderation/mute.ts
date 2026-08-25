import { SlashCommandBuilder, PermissionsBitField, type GuildMember } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, canModerate, Perms } from "../../utils/permissions.js";
import { modActionEmbed, dangerEmbed, warningEmbed, Colors } from "../../utils/embeds.js";
import { addModlog, getGuild } from "../../utils/dbops.js";
import { parseDuration, formatDuration } from "../../utils/time.js";
import { addTemprole } from "../../systems/temproles.js";

export const mute: Command = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Rendre muet un membre via le rôle mute")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre à muter").setRequired(true))
    .addStringOption((o) => o.setName("duree").setDescription("Durée : 10m, 1h, 1d (vide = permanent)").setRequired(false))
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ModerateMembers, "Modérer des membres")) return;

    const config = await getGuild(interaction.guild!.id);
    if (!config?.muteRoleId) {
      await interaction.reply({ embeds: [warningEmbed("Rôle mute non configuré", "Utilisez `/set muterole` pour configurer le rôle mute.")], ephemeral: true });
      return;
    }

    const target = interaction.options.getMember("utilisateur") as GuildMember | null;
    const durationStr = interaction.options.getString("duree");
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!target) {
      await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Ce membre n'est pas sur le serveur.")], ephemeral: true });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({ embeds: [dangerEmbed("Interdit", "Vous ne pouvez pas vous muter vous-même.")], ephemeral: true });
      return;
    }

    if (!canModerate(interaction.member as GuildMember, target)) {
      await interaction.reply({ embeds: [dangerEmbed("Impossible", "Vous ne pouvez pas modérer cet utilisateur.")], ephemeral: true });
      return;
    }

    if (target.roles.cache.has(config.muteRoleId)) {
      await interaction.reply({ embeds: [warningEmbed("Déjà muté", "Ce membre possède déjà le rôle mute.")], ephemeral: true });
      return;
    }

    const durationMs = durationStr ? parseDuration(durationStr) : null;
    if (durationStr && !durationMs) {
      await interaction.reply({ embeds: [dangerEmbed("Durée invalide", "Format : `10m`, `1h`, `2d`")], ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      await target.roles.add(config.muteRoleId, `[Mute] ${interaction.user.username}: ${reason}`);
      await addModlog({ guildId: interaction.guild!.id, userId: target.id, moderatorId: interaction.user.id, action: "mute", reason, duration: durationStr ?? undefined });

      // Schedule auto-unmute via the temproles system (persists across restarts)
      if (durationMs) {
        await addTemprole(interaction.client, {
          guildId: interaction.guild!.id,
          userId: target.id,
          roleId: config.muteRoleId,
          expiresAt: new Date(Date.now() + durationMs),
        }).catch(() => null);
      }

      const embed = modActionEmbed({
        action: "Membre Muté",
        target: `${target.user.username} (\`${target.id}\`)`,
        moderator: interaction.user.username,
        reason,
        duration: durationMs ? formatDuration(durationMs) : "Permanent",
        color: Colors.warning,
        emoji: "🔇",
      });

      await interaction.editReply({ embeds: [embed] });

      if (config.logChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }

      // Notify target via DM
      await target.send({
        embeds: [dangerEmbed(`🔇 Mute — ${interaction.guild!.name}`,
          `Vous avez été muté.\n**Raison :** ${reason}\n**Durée :** ${durationMs ? formatDuration(durationMs) : "Permanent"}`
        )],
      }).catch(() => null);
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de muter cet utilisateur. Vérifiez la hiérarchie des rôles.")] });
    }
  },
};

export const unmute: Command = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Retirer le mute d'un membre")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre à démuter").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ModerateMembers, "Modérer des membres")) return;

    const config = await getGuild(interaction.guild!.id);
    if (!config?.muteRoleId) {
      await interaction.reply({ embeds: [warningEmbed("Rôle mute non configuré", "Utilisez `/set muterole` pour configurer le rôle mute.")], ephemeral: true });
      return;
    }

    const target = interaction.options.getMember("utilisateur") as GuildMember | null;
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!target) {
      await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Ce membre n'est pas sur le serveur.")], ephemeral: true });
      return;
    }

    if (!target.roles.cache.has(config.muteRoleId)) {
      await interaction.reply({ embeds: [warningEmbed("Pas muté", "Ce membre n'est pas muté.")], ephemeral: true });
      return;
    }

    await interaction.deferReply();
    try {
      await target.roles.remove(config.muteRoleId, `[Unmute] ${interaction.user.username}: ${reason}`);
      await addModlog({ guildId: interaction.guild!.id, userId: target.id, moderatorId: interaction.user.id, action: "unmute", reason });

      const embed = modActionEmbed({
        action: "Membre Démuté",
        target: `${target.user.username} (\`${target.id}\`)`,
        moderator: interaction.user.username,
        reason,
        color: Colors.success,
        emoji: "🔊",
      });
      await interaction.editReply({ embeds: [embed] });

      if (config.logChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de démuter cet utilisateur.")] });
    }
  },
};
