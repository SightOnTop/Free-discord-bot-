import type { Client } from "discord.js";
import { getPendingReminders, getUnsentReminders, markReminderSent, createReminder } from "../utils/dbops.js";
import { infoEmbed } from "../utils/embeds.js";
import { parseDuration, MAX_TIMEOUT_MS } from "../utils/time.js";
import { logger } from "../../lib/logger.js";
import type { InsertReminder } from "@workspace/db";

const scheduledReminders = new Map<number, NodeJS.Timeout>();
const firingReminders = new Set<number>();

async function fireReminder(client: Client, id: number, userId: string, channelId: string, message: string) {
  if (firingReminders.has(id)) return;
  firingReminders.add(id);

  try {
    const embed = infoEmbed("⏰ Rappel !", message);
    let delivered = false;

    // Try DM first, then channel. Keep it pending if both deliveries fail.
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
      delivered = true;
    } catch {
      const channel = client.channels.cache.get(channelId);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        await channel.send({ content: "<@" + userId + ">", embeds: [embed] });
        delivered = true;
      }
    }

    if (!delivered) throw new Error("Aucun canal disponible pour envoyer le rappel");
    await markReminderSent(id);
    scheduledReminders.delete(id);
  } catch (err) {
    logger.error({ err, id }, "[Reminder] Erreur d'envoi — rappel conservé pour réessai");
  } finally {
    firingReminders.delete(id);
  }
}

function scheduleReminder(client: Client, id: number, userId: string, channelId: string, message: string, remindAt: Date) {
  const ms = remindAt.getTime() - Date.now();
  if (ms <= 0) {
    void fireReminder(client, id, userId, channelId, message);
    return;
  }

  const timer = setTimeout(() => {
    const remaining = remindAt.getTime() - Date.now();
    if (remaining > 0) {
      scheduleReminder(client, id, userId, channelId, message, remindAt);
      return;
    }
    void fireReminder(client, id, userId, channelId, message);
  }, Math.min(ms, MAX_TIMEOUT_MS));
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
  if (timer) {
    clearTimeout(timer);
    scheduledReminders.delete(id);
  }
}

export async function setupReminders(client: Client) {
  try {
    const reminders = await getUnsentReminders();
    for (const reminder of reminders) {
      scheduleReminder(client, reminder.id, reminder.userId, reminder.channelId, reminder.message, reminder.remindAt);
    }
    logger.info("[Reminders] " + reminders.length + " rappel(s) restauré(s)");
  } catch (err) {
    logger.error({ err }, "[Reminders] Erreur restauration");
  }

  // Recover reminders whose timer was interrupted or whose process slept.
  setInterval(async () => {
    try {
      const pending = await getPendingReminders();
      for (const reminder of pending) {
        if (!scheduledReminders.has(reminder.id)) {
          void fireReminder(client, reminder.id, reminder.userId, reminder.channelId, reminder.message);
        }
      }
    } catch (err) {
      logger.error({ err }, "[Reminders] Erreur vérification périodique");
    }
  }, 60_000);
}
