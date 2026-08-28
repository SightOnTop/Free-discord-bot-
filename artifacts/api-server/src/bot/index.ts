import { Collection, REST, Routes } from "discord.js";
import { createClient } from "./client.js";
import { logger } from "../lib/logger.js";
import type { Command, BotEvent, ModeraxClient } from "./types.js";

// ── Moderation Commands ───────────────────────────────────────────────────────
import { ban } from "./commands/moderation/ban.js";
import { kick } from "./commands/moderation/kick.js";
import { mute, unmute } from "./commands/moderation/mute.js";
import { timeout, untimeout } from "./commands/moderation/timeout.js";
import { warn, warnings, clearwarn, clearwarns } from "./commands/moderation/warn.js";
import { clear } from "./commands/moderation/clear.js";
import { lock, unlock, slowmode, unban } from "./commands/moderation/lock.js";
import { nuke, purge, temprole, report, softban } from "./commands/moderation/advanced.js";

// ── Admin Commands ────────────────────────────────────────────────────────────
import { set } from "./commands/admin/set.js";
import { config } from "./commands/admin/config.js";
import { antinuke } from "./commands/admin/antinuke.js";
import { automod } from "./commands/admin/automod.js";

// ── Ticket Commands ───────────────────────────────────────────────────────────
import { ticket } from "./commands/ticket/ticket.js";

// ── Community Commands ────────────────────────────────────────────────────────
import { giveaway } from "./commands/community/giveaway.js";
import { poll, announce } from "./commands/community/poll.js";
import { suggest } from "./commands/community/suggest.js";
import { remind } from "./commands/community/remind.js";

// ── Leveling Commands ─────────────────────────────────────────────────────────
import { rank, leaderboard, resetLevel } from "./commands/leveling/rank.js";

// ── Fun Commands ──────────────────────────────────────────────────────────────
import { eightBall, dice, coinflip, choose, avatar, rps, calc } from "./commands/fun/fun.js";

// ── Info Commands ─────────────────────────────────────────────────────────────
import { help } from "./commands/info/help.js";
import { userinfo, serverinfo, botinfo } from "./commands/info/userinfo.js";

// ── Events ────────────────────────────────────────────────────────────────────
import { readyEvent } from "./events/ready.js";
import { guildCreateEvent } from "./events/guildCreate.js";
import { guildMemberAddEvent } from "./events/guildMemberAdd.js";
import { interactionCreateEvent } from "./events/interactionCreate.js";

// ── Systems ───────────────────────────────────────────────────────────────────
import { setupAntiNuke } from "./systems/antiNuke.js";
import { setupAntiSpam } from "./systems/antiSpam.js";
import { setupLeveling } from "./systems/leveling.js";
import { setupBadwords } from "./systems/badwords.js";
import { setupGiveaways } from "./systems/giveaway.js";
import { setupReminders } from "./systems/reminder.js";
import { setupTemproles } from "./systems/temproles.js";
import { setupPolls } from "./commands/community/poll.js";

// ── All Commands ──────────────────────────────────────────────────────────────
const ALL_COMMANDS: Command[] = [
  // Moderation
  ban, kick, mute, unmute, timeout, untimeout,
  warn, warnings, clearwarn, clearwarns,
  clear, lock, unlock, slowmode, unban,
  nuke, purge, temprole, report, softban,
  // Admin
  set, config, antinuke, automod,
  // Tickets
  ticket,
  // Community
  giveaway, poll, announce, suggest, remind,
  // Leveling
  rank, leaderboard, resetLevel,
  // Fun
  eightBall, dice, coinflip, choose, avatar, rps, calc,
  // Info
  help, userinfo, serverinfo, botinfo,
];

const ALL_EVENTS: BotEvent[] = [
  readyEvent,
  guildCreateEvent,
  guildMemberAddEvent,
  interactionCreateEvent,
];

async function deployCommands(client: ModeraxClient, token: string) {
  const rest = new REST({ version: "10" }).setToken(token);
  const body = ALL_COMMANDS.map((cmd) => cmd.data.toJSON());
  logger.info(`[Moderax] Déploiement de ${body.length} commandes slash...`);
  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body });
    logger.info(`[Moderax] ${body.length} commandes slash déployées ✅`);
  } catch (err) {
    logger.error({ err }, "[Moderax] Erreur déploiement commandes");
  }
}

export async function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("[Moderax] DISCORD_BOT_TOKEN non défini — bot désactivé.");
    return;
  }

  const client = createClient() as ModeraxClient;
  client.commands = new Collection<string, Command>();

  // Load commands
  for (const cmd of ALL_COMMANDS) {
    client.commands.set(cmd.data.name, cmd);
  }

  // Register events
  for (const event of ALL_EVENTS) {
    if (event.once) {
      client.once(event.name, (...args) => void event.execute(...args));
    } else {
      client.on(event.name, (...args) => void event.execute(...args));
    }
  }

  // Setup passive systems
  setupAntiNuke(client);
  setupAntiSpam(client);
  setupLeveling(client);
  setupBadwords(client);

  // Deploy after ready
  client.once("clientReady", async (readyClient) => {
    await deployCommands(client, token);
    // Setup async systems that need DB
    await setupGiveaways(readyClient).catch((err) => logger.error({ err }, "[Giveaway] Setup error"));
    await setupPolls(readyClient).catch((err) => logger.error({ err }, "[Poll] Setup error"));
    await setupReminders(readyClient).catch((err) => logger.error({ err }, "[Reminders] Setup error"));
    await setupTemproles(readyClient).catch((err) => logger.error({ err }, "[TempRoles] Setup error"));
  });

  await client.login(token);
  logger.info("[Moderax] Connexion en cours...");
}
