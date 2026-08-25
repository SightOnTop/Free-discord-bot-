import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";

export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildBans,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.GuildMember,
    ],
  });
}
