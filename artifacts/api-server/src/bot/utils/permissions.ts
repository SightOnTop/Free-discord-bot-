import {
  type ChatInputCommandInteraction,
  PermissionsBitField,
  type GuildMember,
} from "discord.js";
import { dangerEmbed } from "./embeds.js";

/**
 * Checks that the interaction member has the given permission.
 * Replies with an ephemeral error and returns false if not.
 */
export async function requirePermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint,
  label: string,
): Promise<boolean> {
  const member = interaction.member as GuildMember;
  if (!member.permissions.has(permission)) {
    const reply = {
      embeds: [dangerEmbed("Permission refusée", `Vous devez avoir la permission **${label}** pour utiliser cette commande.`)],
      ephemeral: true as const,
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
    return false;
  }
  return true;
}

/**
 * Returns true if the moderator can act on the target member
 * (respects role hierarchy and bot hierarchy).
 */
export function canModerate(moderator: GuildMember, target: GuildMember): boolean {
  if (!moderator.guild.members.me)                                                   return false;
  if (target.id === moderator.guild.ownerId)                                         return false;
  if (target.id === moderator.client.user?.id)                                       return false;
  if (moderator.guild.members.me.roles.highest.comparePositionTo(target.roles.highest) <= 0) return false;
  if (moderator.roles.highest.comparePositionTo(target.roles.highest) <= 0)          return false;
  return true;
}

/** Shorthand for all PermissionsBitField.Flags */
export const Perms = PermissionsBitField.Flags;
