import {
  type GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  EmbedBuilder,
} from "discord.js";
import { getGuild } from "../utils/dbops.js";
import { successEmbed, dangerEmbed } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";

// pending: guildId:userId → { guildId, code, roleId, timeout }
const pending = new Map<string, { guildId: string; code: string; roleId: string; timeout: NodeJS.Timeout }>();

function captchaKey(guildId: string, userId: string) {
  return guildId + ":" + userId;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function startCaptcha(member: GuildMember) {
  const config = await getGuild(member.guild.id);
  if (!config?.captchaEnabled || !config.captchaRoleId || !config.captchaChannelId) return;

  const code = generateCode();
  const captchaChannel = member.guild.channels.cache.get(config.captchaChannelId);
  if (!captchaChannel?.isTextBased()) return;

  // Timeout: 3 minutes
  const timeout = setTimeout(async () => {
    pending.delete(captchaKey(member.guild.id, member.id));
    await member.kick("Captcha non complété dans les 3 minutes").catch(() => null);
  }, 3 * 60_000);

  pending.set(captchaKey(member.guild.id, member.id), {
    guildId: member.guild.id,
    code,
    roleId: config.captchaRoleId,
    timeout,
  });

  const embed = new EmbedBuilder()
    .setColor(0x0d0d0d)
    .setTitle("🔐 Vérification Humaine — Moderax Captcha")
    .setDescription(
      `Bienvenue **${member.user.username}** !\n\nPour accéder au serveur, vous devez prouver que vous êtes humain.\n\n` +
      `**Code de vérification :**\n\`\`\`${code}\`\`\`\n\nCliquez sur **Vérifier** et entrez ce code. Vous avez **3 minutes**.`
    )
    .setFooter({ text: "Moderax • Protection Anti-Bot" })
    .setTimestamp();

  const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`captcha:${member.guild.id}:${member.id}`)
      .setLabel("🔐 Vérifier")
      .setStyle(ButtonStyle.Primary)
  );

  await captchaChannel.send({ content: `${member}`, embeds: [embed], components: [button] });
}

export async function handleCaptchaButton(interaction: ButtonInteraction) {
  const [, guildId, userId] = interaction.customId.split(":");
  if (!guildId || !userId) return;

  const data = pending.get(captchaKey(guildId, userId));
  if (!data) {
    await interaction.reply({ embeds: [dangerEmbed("Session expirée", "Ce captcha a expiré ou est invalide.")], ephemeral: true });
    return;
  }

  if (interaction.user.id !== userId) {
    await interaction.reply({ embeds: [dangerEmbed("Pas pour vous", "Ce captcha ne vous est pas destiné.")], ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`captcha_modal:${guildId}:${userId}`)
    .setTitle("Entrez le code de vérification")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("code")
          .setLabel("Code (6 caractères)")
          .setStyle(TextInputStyle.Short)
          .setMinLength(6)
          .setMaxLength(6)
          .setPlaceholder("Ex: ABC123")
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

export async function handleCaptchaModal(interaction: ModalSubmitInteraction) {
  const [, guildId, userId] = interaction.customId.split(":");
  if (!guildId || !userId) return;

  const data = pending.get(captchaKey(guildId, userId));
  if (!data) {
    await interaction.reply({ embeds: [dangerEmbed("Session expirée", "Ce captcha a expiré.")], ephemeral: true });
    return;
  }

  if (!interaction.guild || interaction.guild.id !== guildId) {
    await interaction.reply({ embeds: [dangerEmbed("Session invalide", "Ce captcha appartient à un autre serveur.")], ephemeral: true });
    return;
  }

  const entered = interaction.fields.getTextInputValue("code").toUpperCase().trim();

  if (entered !== data.code) {
    await interaction.reply({
      embeds: [dangerEmbed("Code incorrect", "Le code entré est invalide. Réessayez ou contactez un administrateur.")],
      ephemeral: true,
    });
    return;
  }

  clearTimeout(data.timeout);
  pending.delete(captchaKey(guildId, userId));

  try {
    const guild = interaction.guild!;
    const member = await guild.members.fetch(userId);
    await member.roles.add(data.roleId);
    await interaction.reply({ embeds: [successEmbed("Vérification réussie !", "Bienvenue sur le serveur ! 🎉")], ephemeral: true });
    // Delete the captcha message
    await interaction.message?.delete().catch(() => null);
  } catch (err) {
    logger.error({ err }, "[Captcha] Erreur d'ajout de rôle");
    await interaction.reply({ embeds: [dangerEmbed("Erreur", "Impossible d'ajouter le rôle. Contactez un administrateur.")], ephemeral: true });
  }
}
