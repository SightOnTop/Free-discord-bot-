import {
  type Guild,
  type GuildMember,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
  type TextChannel,
} from "discord.js";
import { getGuild, createTicket, getTicketByChannel, closeTicket } from "../utils/dbops.js";
import { successEmbed, dangerEmbed, infoEmbed } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";

export async function openTicket(guild: Guild, member: GuildMember, subject?: string): Promise<TextChannel | null> {
  const config = await getGuild(guild.id);
  if (!config?.ticketCategoryId) return null;

  const category = guild.channels.cache.get(config.ticketCategoryId);
  if (!category || category.type !== ChannelType.GuildCategory) return null;

  // Check if user already has an open ticket
  const existing = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.name === `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`
  );
  if (existing) return existing as TextChannel;

  const ticketChannel = await guild.channels.create({
    name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)}`,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: member.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
      {
        id: guild.members.me!.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
      },
    ],
  }) as TextChannel;

  await createTicket({ guildId: guild.id, userId: member.id, channelId: ticketChannel.id, subject: subject ?? null, status: "open" });

  const embed = new EmbedBuilder()
    .setColor(0x0d0d0d)
    .setTitle("🎫 Ticket ouvert")
    .setDescription(
      `Bonjour ${member} !\n\nUn membre du staff va vous répondre prochainement.\n` +
      (subject ? `**Sujet :** ${subject}\n` : "") +
      `\nPour fermer ce ticket, cliquez sur **Fermer le ticket**.`
    )
    .setFooter({ text: "Moderax • Système de tickets" })
    .setTimestamp();

  const closeBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticketChannel.id}`)
      .setLabel("🔒 Fermer le ticket")
      .setStyle(ButtonStyle.Danger)
  );

  await ticketChannel.send({ content: `${member}`, embeds: [embed], components: [closeBtn] });
  return ticketChannel;
}

export async function handleTicketClose(interaction: ButtonInteraction) {
  const channelId = interaction.customId.split(":")[2];
  if (!channelId) return;

  const ticket = await getTicketByChannel(channelId);
  if (!ticket || ticket.status === "closed") {
    await interaction.reply({ embeds: [dangerEmbed("Ticket invalide", "Ce ticket est déjà fermé ou introuvable.")], ephemeral: true });
    return;
  }

  await interaction.reply({ embeds: [infoEmbed("Fermeture...", "Ce ticket va être fermé dans 5 secondes.")] });

  await closeTicket(channelId, interaction.user.id);

  const config = await getGuild(interaction.guild!.id);

  // Log to ticket log channel
  if (config?.ticketLogChannelId) {
    const logChannel = interaction.guild!.channels.cache.get(config.ticketLogChannelId);
    if (logChannel?.isTextBased()) {
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x636efa)
            .setTitle("🎫 Ticket fermé")
            .addFields(
              { name: "👤 Ouvert par", value: `<@${ticket.userId}>`, inline: true },
              { name: "🔒 Fermé par", value: `${interaction.user}`, inline: true },
              { name: "📋 Sujet", value: ticket.subject ?? "N/A", inline: true },
            )
            .setFooter({ text: "Moderax • Système de tickets" })
            .setTimestamp(),
        ],
      });
    }
  }

  if (interaction.channel?.isTextBased() && !interaction.channel.isDMBased()) {
    await interaction.channel.send({ embeds: [successEmbed("Ticket fermé", "Ce salon sera supprimé dans 5 secondes.")] });
  }
  setTimeout(async () => {
    try {
      await interaction.channel?.delete("Ticket fermé");
    } catch (err) {
      logger.error({ err }, "[Ticket] Erreur suppression salon");
    }
  }, 5000);
}
