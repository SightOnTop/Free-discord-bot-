import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../types.js";
import { infoEmbed, dangerEmbed, successEmbed } from "../../utils/embeds.js";
import { getUserReminders, deleteReminder } from "../../utils/dbops.js";
import { parseDuration, discordTimestamp } from "../../utils/time.js";
import { setReminder, cancelScheduledReminder } from "../../systems/reminder.js";

export const remind: Command = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Gérer vos rappels")
    .addSubcommand((s) =>
      s.setName("set").setDescription("Créer un rappel")
        .addStringOption((o) => o.setName("duree").setDescription("Dans combien de temps : 10m, 1h, 2d").setRequired(true))
        .addStringOption((o) => o.setName("message").setDescription("Message du rappel").setRequired(true).setMaxLength(500))
    )
    .addSubcommand((s) =>
      s.setName("list").setDescription("Voir vos rappels actifs")
    )
    .addSubcommand((s) =>
      s.setName("cancel").setDescription("Annuler un rappel")
        .addIntegerOption((o) => o.setName("id").setDescription("ID du rappel").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "set": {
        const durationStr = interaction.options.getString("duree", true);
        const message = interaction.options.getString("message", true);

        const ms = parseDuration(durationStr);
        if (!ms) {
          await interaction.reply({ embeds: [dangerEmbed("Durée invalide", "Formats acceptés : `10m`, `1h`, `2d` (max 30 jours)")], ephemeral: true });
          return;
        }
        if (ms > 30 * 24 * 60 * 60 * 1000) {
          await interaction.reply({ embeds: [dangerEmbed("Trop long", "Durée maximale : 30 jours.")], ephemeral: true });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        const remindAt = new Date(Date.now() + ms);
        const reminder = await setReminder(interaction.client, {
          userId: interaction.user.id,
          guildId: interaction.guild?.id ?? null,
          channelId: interaction.channelId,
          message,
          remindAt,
          sent: false,
        });

        await interaction.editReply({
          embeds: [successEmbed("Rappel créé !", `Je vous rappellerai ${discordTimestamp(remindAt, "R")} (${discordTimestamp(remindAt, "F")}).\n**Message :** ${message}\n**ID :** #${reminder.id}`)],
        });
        break;
      }

      case "list": {
        await interaction.deferReply({ ephemeral: true });
        const reminders = await getUserReminders(interaction.user.id);

        if (reminders.length === 0) {
          await interaction.editReply({ embeds: [infoEmbed("Aucun rappel", "Vous n'avez pas de rappel actif. Utilisez `/remind set` pour en créer un.")] });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x636efa)
          .setTitle("⏰ Vos rappels actifs")
          .setDescription(
            reminders.map((r) => `**#${r.id}** — ${discordTimestamp(r.remindAt, "R")} (${discordTimestamp(r.remindAt, "F")})\n> ${r.message}`).join("\n\n")
          )
          .setFooter({ text: `${reminders.length} rappel(s) | Moderax` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "cancel": {
        const id = interaction.options.getInteger("id", true);
        await interaction.deferReply({ ephemeral: true });

        await deleteReminder(id, interaction.user.id);
        cancelScheduledReminder(id);
        await interaction.editReply({ embeds: [successEmbed("Rappel annulé", `Rappel #${id} supprimé.`)] });
        break;
      }
    }
  },
};
