import type { GuildMember } from "discord.js";
import type { BotEvent } from "../types.js";
import { getGuild, upsertGuild } from "../utils/dbops.js";
import { startCaptcha } from "../systems/captcha.js";
import { logger } from "../../lib/logger.js";
import { EmbedBuilder } from "discord.js";

export const guildMemberAddEvent: BotEvent = {
  name: "guildMemberAdd",
  async execute(member: GuildMember) {
    const config = await getGuild(member.guild.id);
    if (!config) {
      await upsertGuild({ guildId: member.guild.id }).catch(() => null);
    }

    const captchaConfigured = Boolean(config?.captchaEnabled && config.captchaRoleId && config.captchaChannelId);

    // Do not grant the autorole before a configured captcha is completed.
    if (config?.autoRoleId && !member.user.bot && !captchaConfigured) {
      await member.roles.add(config.autoRoleId).catch((err) =>
        logger.warn({ err }, "[Moderax] Impossible d'ajouter l'autorole")
      );
    }

    // Captcha (overrides autorole — role given after captcha completion)
    if (captchaConfigured && !member.user.bot) {
      await startCaptcha(member).catch((err) =>
        logger.warn({ err }, "[Moderax] Erreur démarrage captcha")
      );
      return; // Don't send welcome if captcha is enabled
    }

    // Welcome message
    if (config?.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(config.welcomeChannelId);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x0d0d0d)
          .setTitle(`👋 Bienvenue sur ${member.guild.name} !`)
          .setDescription(`${member} vient de rejoindre le serveur !\nTu es le **${member.guild.memberCount}ème** membre.`)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: "Moderax • Système de bienvenue" })
          .setTimestamp();

        await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
      }
    }
  },
};
