import type { Client } from "discord.js";
import { getPendingReminders, markReminderSent, createReminder } from "../utils/dbops.js";
import { infoEmbed } from "../utils/embeds.js";
import { parseDuration } from "../utils/time.js";
import { logger } from "../../lib/logger.js";
import type { InsertReminder } from "@workspace/db";

const scheduledReminders = new Map<number, NodeJS.Timeout>();

async function fireReminder(client: Client, id: number, userId: string, channelId: string, message: string) {
  try {
    await markReminderSent(id);
    scheduledReminders.delete(id);

    const embed = infoEmbed("⏰ Rappel !", message);

    // Try DM first, then channel
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
    } catch {
      const channel = client.channels.cache.get(channelId);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        await channel.send({ content: `<@${userId}>`, embeds: [embed] });
      }
    }
  } catch (err) {
    logger.error({ err, id }, "[Reminder] Erreur d'envoi");
  }
}

function scheduleReminder(client: Client, id: number, userId: string, channelId: string, message: string, remindAt: Date) {
  const ms = remindAt.getTime() - Date.now();
  if (ms <= 0) {
    void fireReminder(client, id, userId, channelId, message);
    return;
  }
  const timer = setTimeout(() => fireReminder(client, id, userId, channelId, message), ms);
  scheduledReminders.set(id, timer);
}

export async function setReminder(client: Client, data: InsertReminder) {
  const ms = data.remindAt.getTime() - Date.now();
  if (ms <= 0) throw new Error("La date doit être dans le futur");
  const reminder = await createReminder(data);
  scheduleReminder(client, reminder.id, data.userId, data.channelId, data.message, data.remindAt);
  return reminder;
}

export function cancelScheduledReminder(id: number) {
  const timer = scheduledReminders.get(id);
  if (timer) { clearTimeout(timer); scheduledReminders.delete(id); }
}

export async function setupReminders(client: Client) {
  // On startup, load pending reminders from DB and schedule them
  try {
    const pending = await getPendingReminders();
    for (const r of pending) {
      fireReminder(client, r.id, r.userId, r.channelId, r.message);
    }
    logger.info(`[Reminders] ${pending.length} rappel(s) en attente traité(s)`);
  } catch (err) {
    logger.error({ err }, "[Reminders] Erreur restauration");
  }

  // Periodic check every minute for any missed reminders
  setInterval(async () => {
    try {
      const pending = await getPendingReminders();
      for (const r of pending) {
        if (!scheduledReminders.has(r.id)) {
          fireReminder(client, r.id, r.userId, r.channelId, r.message);
        }
      }
    } catch (err) {
      logger.error({ err }, "[Reminders] Erreur vérification périodique");
    }
  }, 60_000);
}

export { parseDuration };
