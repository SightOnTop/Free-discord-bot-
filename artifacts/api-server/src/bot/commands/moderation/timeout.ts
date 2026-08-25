import { SlashCommandBuilder, PermissionsBitField, type GuildMember } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, canModerate, Perms } from "../../utils/permissions.js";
import { modActionEmbed, dangerEmbed, Colors } from "../../utils/embeds.js";
import { addModlog, getGuild } from "../../utils/dbops.js";
import { parseDuration, formatDuration } from "../../utils/time.js";

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1_000;

export const timeout: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Mettre un membre en isolement temporaire (Discord natif)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre à isoler").setRequired(true))
    .addStringOption((o) => o.setName("duree").setDescription("Durée : 10m, 1h, 1d (max 28j)").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ModerateMembers, "Modérer des membres")) return;

    const target = interaction.options.getMember("utilisateur") as GuildMember | null;
    const durationStr = interaction.options.getString("duree", true);
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!target) {
      await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Ce membre n'est pas sur le serveur.")], ephemeral: true });
      return;
    }

    if (target.id === interaction.user.id) {
      await interaction.reply({ embeds: [dangerEmbed("Interdit", "Vous ne pouvez pas vous isoler vous-même.")], ephemeral: true });
      return;
    }

    if (!canModerate(interaction.member as GuildMember, target)) {
      await interaction.reply({ embeds: [dangerEmbed("Impossible", "Vous ne pouvez pas modérer cet utilisateur.")], ephemeral: true });
      return;
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      await interaction.reply({ embeds: [dangerEmbed("Durée invalide", "Format accepté : `10m`, `1h`, `2d`. Maximum 28 jours.")], ephemeral: true });
      return;
    }

    if (durationMs > MAX_TIMEOUT_MS) {
      await interaction.reply({ embeds: [dangerEmbed("Durée trop longue", "La durée maximale d'un timeout est **28 jours**.")], ephemeral: true });
      return;
    }

    await interaction.deferReply();
    try {
      await target.timeout(durationMs, `${interaction.user.username}: ${reason}`);
      await addModlog({ guildId: interaction.guild!.id, userId: target.id, moderatorId: interaction.user.id, action: "timeout", reason, duration: durationStr });

      const embed = modActionEmbed({
        action: "Timeout Appliqué",
        target: `${target.user.username} (\`${target.id}\`)`,
        moderator: interaction.user.username,
        reason,
        duration: formatDuration(durationMs),
        color: Colors.warning,
        emoji: "⏱️",
      });
      await interaction.editReply({ embeds: [embed] });

      const config = await getGuild(interaction.guild!.id);
      if (config?.logChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }

      await target.send({
        embeds: [dangerEmbed(`⏱️ Timeout — ${interaction.guild!.name}`,
          `Vous avez reçu un timeout.\n**Raison :** ${reason}\n**Durée :** ${formatDuration(durationMs)}`
        )],
      }).catch(() => null);
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible d'appliquer le timeout. Vérifiez mes permissions.")] });
    }
  },
};

export const untimeout: Command = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Lever le timeout d'un membre")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ModerateMembers, "Modérer des membres")) return;

    const target = interaction.options.getMember("utilisateur") as GuildMember | null;
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!target) {
      await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Membre introuvable.")], ephemeral: true });
      return;
    }

    if (!target.isCommunicationDisabled()) {
      await interaction.reply({ embeds: [dangerEmbed("Pas en timeout", "Ce membre n'est pas en timeout.")], ephemeral: true });
      return;
    }

    await interaction.deferReply();
    try {
      await target.timeout(null, reason);
      const embed = modActionEmbed({
        action: "Timeout Levé",
        target: `${target.user.username} (\`${target.id}\`)`,
        moderator: interaction.user.username,
        reason,
        color: Colors.success,
        emoji: "✅",
      });
      await interaction.editReply({ embeds: [embed] });

      const config = await getGuild(interaction.guild!.id);
      if (config?.logChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de lever le timeout.")] });
    }
  },
};
