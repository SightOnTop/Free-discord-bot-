import {
  SlashCommandBuilder, PermissionsBitField, ChannelType,
  type TextChannel, type GuildMember, EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, canModerate, Perms } from "../../utils/permissions.js";
import { successEmbed, dangerEmbed, infoEmbed, Colors } from "../../utils/embeds.js";
import { addModlog, getGuild } from "../../utils/dbops.js";
import { addTemprole } from "../../systems/temproles.js";
import { parseDuration, formatDuration } from "../../utils/time.js";
import { logger } from "../../../lib/logger.js";

export const nuke: Command = {
  data: new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("Supprimer et recréer un salon (efface tous les messages)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addChannelOption((o) =>
      o.setName("salon").setDescription("Salon à nuker (actuel par défaut)").addChannelTypes(ChannelType.GuildText).setRequired(false)
    )
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageChannels, "Gérer les salons")) return;

    const target = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel;
    const reason = interaction.options.getString("raison") ?? "Nettoyage du salon";

    // Acknowledge before deleting (the original channel may be deleted)
    await interaction.reply({ embeds: [dangerEmbed("Nuke en cours…", `${target} va être recréé. Ceci est **irréversible**.`)] });

    try {
      const position = target.position;

      const newChannel = await target.clone({
        name: target.name,
        topic: target.topic ?? undefined,
        reason: `[Moderax Nuke] ${interaction.user.username}: ${reason}`,
      });
      await newChannel.setPosition(position).catch(() => null);
      await target.delete(`[Moderax Nuke] ${reason}`).catch(() => null);

      await newChannel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xff3b30)
          .setTitle("💥 NUKE — Salon purgé")
          .setDescription(`Ce salon a été nuke par ${interaction.user}.\n**Raison :** ${reason}`)
          .setFooter({ text: "Moderax • Nuke" })
          .setTimestamp()],
      });
    } catch (err) {
      logger.error({ err }, "[Nuke] Erreur lors du nuke du salon");
    }
  },
};

export const purge: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Suppression avancée de messages")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addSubcommand((s) =>
      s.setName("bots").setDescription("Supprimer les messages de bots")
        .addIntegerOption((o) => o.setName("nombre").setDescription("Nombre (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("user").setDescription("Supprimer les messages d'un utilisateur")
        .addUserOption((o) => o.setName("utilisateur").setDescription("Utilisateur").setRequired(true))
        .addIntegerOption((o) => o.setName("nombre").setDescription("Nombre (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("contains").setDescription("Supprimer les messages contenant un texte")
        .addStringOption((o) => o.setName("texte").setDescription("Texte à rechercher").setRequired(true))
        .addIntegerOption((o) => o.setName("nombre").setDescription("Messages à scanner (10-100)").setMinValue(10).setMaxValue(100).setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("embeds").setDescription("Supprimer les messages avec embeds ou images")
        .addIntegerOption((o) => o.setName("nombre").setDescription("Nombre (1-100)").setMinValue(1).setMaxValue(100).setRequired(true))
    ),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageMessages, "Gérer les messages")) return;

    const sub = interaction.options.getSubcommand();
    const channel = interaction.channel as TextChannel;
    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const recent = messages.filter(
        (m) => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1_000,
      );

      let toDelete: ReturnType<typeof recent.first>;

      switch (sub) {
        case "bots": {
          const num = interaction.options.getInteger("nombre", true);
          toDelete = recent.filter((m) => m.author.bot).first(num);
          break;
        }
        case "user": {
          const targetUser = interaction.options.getUser("utilisateur", true);
          const num = interaction.options.getInteger("nombre", true);
          toDelete = recent.filter((m) => m.author.id === targetUser.id).first(num);
          break;
        }
        case "contains": {
          const text = interaction.options.getString("texte", true).toLowerCase();
          const num = interaction.options.getInteger("nombre", true);
          toDelete = recent.filter((m) => m.content.toLowerCase().includes(text)).first(num);
          break;
        }
        case "embeds": {
          const num = interaction.options.getInteger("nombre", true);
          toDelete = recent.filter((m) => m.embeds.length > 0 || m.attachments.size > 0).first(num);
          break;
        }
        default:
          toDelete = [];
      }

      if (!toDelete || toDelete.length === 0) {
        await interaction.editReply({ embeds: [infoEmbed("Aucun message", "Aucun message correspondant trouvé dans les 14 derniers jours.")] });
        return;
      }

      const deleted = await channel.bulkDelete(toDelete, true);
      await interaction.editReply({
        embeds: [successEmbed("Messages supprimés", `**${deleted.size}** message(s) supprimé(s) via \`/purge ${sub}\`.`)],
      });
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de supprimer les messages.")] });
    }
  },
};

export const temprole: Command = {
  data: new SlashCommandBuilder()
    .setName("temprole")
    .setDescription("Attribuer un rôle temporaire à un membre")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre").setRequired(true))
    .addRoleOption((o) => o.setName("role").setDescription("Rôle à attribuer").setRequired(true))
    .addStringOption((o) => o.setName("duree").setDescription("Durée : 10m, 1h, 2d").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageRoles, "Gérer les rôles")) return;

    const target = interaction.options.getMember("utilisateur") as GuildMember | null;
    const role = interaction.options.getRole("role", true);
    const durationStr = interaction.options.getString("duree", true);
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!target) {
      await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Membre introuvable.")], ephemeral: true });
      return;
    }

    const me = interaction.guild!.members.me;
    if (me && me.roles.highest.comparePositionTo(role as never) <= 0) {
      await interaction.reply({ embeds: [dangerEmbed("Hiérarchie", "Ce rôle est au-dessus de mon rôle le plus haut.")], ephemeral: true });
      return;
    }

    const ms = parseDuration(durationStr);
    if (!ms) {
      await interaction.reply({ embeds: [dangerEmbed("Durée invalide", "Format : `10m`, `1h`, `2d`")], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await target.roles.add(role.id, `[TempRole] ${interaction.user.username}: ${reason}`);
      await addTemprole(interaction.client, {
        guildId: interaction.guild!.id,
        userId: target.id,
        roleId: role.id,
        expiresAt: new Date(Date.now() + ms),
      });
      await addModlog({ guildId: interaction.guild!.id, userId: target.id, moderatorId: interaction.user.id, action: "temprole", reason, duration: durationStr });

      await interaction.editReply({
        embeds: [successEmbed("Rôle temporaire attribué",
          `${role} attribué à **${target.user.username}** pour **${formatDuration(ms)}**.\nRetiré automatiquement à l'expiration.`
        )],
      });
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible d'attribuer ce rôle. Vérifiez la hiérarchie.")] });
    }
  },
};

export const report: Command = {
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Signaler un utilisateur au staff")
    .addUserOption((o) => o.setName("utilisateur").setDescription("Utilisateur à signaler").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison du signalement").setRequired(true).setMaxLength(1_000)),

  async execute(interaction) {
    const target = interaction.options.getUser("utilisateur", true);
    const reason = interaction.options.getString("raison", true);

    if (target.id === interaction.user.id) {
      await interaction.reply({ embeds: [dangerEmbed("Interdit", "Vous ne pouvez pas vous signaler vous-même.")], ephemeral: true });
      return;
    }
    if (target.bot) {
      await interaction.reply({ embeds: [dangerEmbed("Interdit", "Vous ne pouvez pas signaler un bot.")], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const config = await getGuild(interaction.guild!.id);
    const reportChannelId = config?.reportChannelId ?? config?.logChannelId;

    if (!reportChannelId) {
      await interaction.editReply({ embeds: [dangerEmbed("Non configuré", "Aucun salon de signalement configuré. Contactez un administrateur.")] });
      return;
    }

    const reportChannel = interaction.guild!.channels.cache.get(reportChannelId);
    if (!reportChannel?.isTextBased() || reportChannel.isDMBased()) {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Le salon de signalement est invalide.")] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.danger)
      .setTitle("🚨 Nouveau Signalement")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "👤 Signalé",     value: `${target.username}\n\`${target.id}\``,          inline: true },
        { name: "🧑‍⚖️ Signalé par", value: `${interaction.user.username}\n\`${interaction.user.id}\``, inline: true },
        { name: "💬 Salon",       value: `${interaction.channel}`,                        inline: true },
        { name: "📋 Raison",      value: reason },
      )
      .setFooter({ text: "Moderax • Signalements" })
      .setTimestamp();

    await reportChannel.send({ embeds: [embed] });
    await interaction.editReply({ embeds: [successEmbed("Signalement envoyé", "Votre signalement a été transmis au staff. Merci !")] });
  },
};

export const softban: Command = {
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Expulser un membre et supprimer ses messages récents (ban + unban immédiat)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addUserOption((o) => o.setName("utilisateur").setDescription("Membre").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.BanMembers, "Bannir des membres")) return;

    const target = interaction.options.getUser("utilisateur", true);
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (target.id === interaction.user.id) {
      await interaction.reply({ embeds: [dangerEmbed("Interdit", "Vous ne pouvez pas vous softbannir vous-même.")], ephemeral: true });
      return;
    }

    const member = interaction.guild!.members.cache.get(target.id) as GuildMember | undefined;
    if (member && !canModerate(interaction.member as GuildMember, member)) {
      await interaction.reply({ embeds: [dangerEmbed("Impossible", "Vous ne pouvez pas modérer cet utilisateur.")], ephemeral: true });
      return;
    }

    await interaction.deferReply();
    try {
      await interaction.guild!.members.ban(target, { reason: `[Softban] ${interaction.user.username}: ${reason}`, deleteMessageSeconds: 7 * 86_400 });
      await interaction.guild!.members.unban(target.id, "Softban — suppression des messages uniquement");
      await addModlog({ guildId: interaction.guild!.id, userId: target.id, moderatorId: interaction.user.id, action: "softban", reason });

      const embed = successEmbed("Softban effectué",
        `**${target.username}** a été softbanni (7 jours de messages supprimés, mais peut revenir).\n**Raison :** ${reason}`
      );
      await interaction.editReply({ embeds: [embed] });

      const config = await getGuild(interaction.guild!.id);
      if (config?.logChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible d'effectuer le softban.")] });
    }
  },
};
