import type { Client } from "discord.js";
import type { BotEvent } from "../types.js";
import { logger } from "../../lib/logger.js";

export const readyEvent: BotEvent = {
  name: "clientReady",
  once: true,
  async execute(client: Client<true>) {
    logger.info(`✅ Moderax connecté en tant que ${client.user.tag}`);
    logger.info(`📡 Présent sur ${client.guilds.cache.size} serveur(s)`);

    client.user.setPresence({
      activities: [{ name: "🛡️ /help | Moderax" }],
      status: "online",
    });
  },
};
