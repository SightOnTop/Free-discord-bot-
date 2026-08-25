import type { Guild } from "discord.js";
import type { BotEvent } from "../types.js";
import { welcomeBotEmbed } from "../utils/embeds.js";
import { upsertGuild } from "../utils/dbops.js";
import { logger } from "../../lib/logger.js";

export const guildCreateEvent: BotEvent = {
  name: "guildCreate",
  async execute(guild: Guild) {
    logger.info({ guildId: guild.id, name: guild.name }, "[Moderax] Rejoint un nouveau serveur");

    // Init guild config in DB
    await upsertGuild({ guildId: guild.id }).catch(() => null);

    const avatarUrl = guild.client.user?.displayAvatarURL({ size: 256 }) ?? null;
    const embeds = welcomeBotEmbed(avatarUrl);

    // Send to system channel or first writable text channel
    const target =
      guild.systemChannel ??
      guild.channels.cache
        .filter(
          (c) =>
            c.isTextBased() &&
            "permissionsFor" in c &&
            c.permissionsFor(guild.members.me!)?.has("SendMessages"),
        )
        .first();

    if (target?.isTextBased()) {
      // Send both embeds in one message (Discord allows up to 10 embeds)
      await target.send({ embeds }).catch(() => null);
    }
  },
};
