import { SlashCommandBuilder, PermissionsBitField, ChannelType, type TextChannel } from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import { successEmbed, dangerEmbed } from "../../utils/embeds.js";
import { getGuild } from "../../utils/dbops.js";

export const lock: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Verrouiller un salon (empêche les membres d'écrire)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addChannelOption((o) =>
      o.setName("salon").setDescription("Salon à verrouiller (actuel par défaut)").addChannelTypes(ChannelType.GuildText).setRequired(false)
    )
    .addStringOption((o) => o.setName("raison").setDescription("Raison du verrouillage").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageChannels, "Gérer les salons")) return;

    const channel = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel;
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    await interaction.deferReply();
    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        SendMessages:     false,
        AddReactions:     false,
        SendMessagesInThreads: false,
      });

      const embed = successEmbed("Salon verrouillé 🔒", `${channel} a été verrouillé.\n**Raison :** ${reason}`);
      await interaction.editReply({ embeds: [embed] });

      if (channel.id !== interaction.channelId) {
        await channel.send({ embeds: [dangerEmbed("🔒 Salon Verrouillé", `Ce salon a été verrouillé par ${interaction.user}.\n**Raison :** ${reason}`)] });
      }

      const config = await getGuild(interaction.guild!.id);
      if (config?.logChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de verrouiller le salon. Vérifiez mes permissions.")] });
    }
  },
};

export const unlock: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Déverrouiller un salon")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addChannelOption((o) =>
      o.setName("salon").setDescription("Salon à déverrouiller (actuel par défaut)").addChannelTypes(ChannelType.GuildText).setRequired(false)
    )
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageChannels, "Gérer les salons")) return;

    const channel = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel;
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    await interaction.deferReply();
    try {
      await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
        SendMessages:          null,
        AddReactions:          null,
        SendMessagesInThreads: null,
      });

      const embed = successEmbed("Salon déverrouillé 🔓", `${channel} est à nouveau ouvert.\n**Raison :** ${reason}`);
      await interaction.editReply({ embeds: [embed] });

      if (channel.id !== interaction.channelId) {
        await channel.send({ embeds: [successEmbed("🔓 Salon Déverrouillé", `Ce salon a été déverrouillé par ${interaction.user}.`)] });
      }

      const config = await getGuild(interaction.guild!.id);
      if (config?.logChannelId) {
        const logChannel = interaction.guild!.channels.cache.get(config.logChannelId);
        if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed] });
      }
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de déverrouiller le salon.")] });
    }
  },
};

export const slowmode: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Définir le mode lent d'un salon")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addIntegerOption((o) => o.setName("secondes").setDescription("Délai en secondes (0 = désactivé, max 21600)").setMinValue(0).setMaxValue(21_600).setRequired(true))
    .addChannelOption((o) => o.setName("salon").setDescription("Salon cible (actuel par défaut)").addChannelTypes(ChannelType.GuildText).setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.ManageChannels, "Gérer les salons")) return;

    const seconds = interaction.options.getInteger("secondes", true);
    const channel = (interaction.options.getChannel("salon") ?? interaction.channel) as TextChannel;

    try {
      await channel.setRateLimitPerUser(seconds, `[Slowmode] ${interaction.user.username}`);
      const msg = seconds === 0
        ? `Mode lent désactivé dans ${channel}.`
        : `Mode lent réglé à **${seconds}s** dans ${channel}.`;
      await interaction.reply({ embeds: [successEmbed("Mode Lent", msg)] });
    } catch {
      await interaction.reply({ embeds: [dangerEmbed("Erreur", "Impossible de modifier le mode lent.")], ephemeral: true });
    }
  },
};

export const unban: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Débannir un utilisateur")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers)
    .addStringOption((o) => o.setName("user_id").setDescription("ID de l'utilisateur à débannir").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    if (!await requirePermission(interaction, Perms.BanMembers, "Bannir des membres")) return;

    const userId = interaction.options.getString("user_id", true).trim();
    const reason = interaction.options.getString("raison") ?? "Aucune raison fournie";

    await interaction.deferReply();
    try {
      const user = await interaction.client.users.fetch(userId);
      await interaction.guild!.members.unban(userId, reason);
      await interaction.editReply({
        embeds: [successEmbed("Membre Débanni", `**${user.username}** (\`${userId}\`) a été débanni.\n**Raison :** ${reason}`)],
      });
    } catch {
      await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de débannir cet utilisateur. Vérifiez l'ID ou qu'il est bien banni.")] });
    }
  },
};
