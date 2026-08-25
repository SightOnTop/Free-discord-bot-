import type { Interaction, ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import type { BotEvent, ModeraxClient } from "../types.js";
import { handleCaptchaButton, handleCaptchaModal } from "../systems/captcha.js";
import { handleTicketClose } from "../systems/ticket.js";
import { handleGiveawayButton } from "../systems/giveaway.js";
import { handleSuggestVote } from "../commands/community/suggest.js";
import { dangerEmbed } from "../utils/embeds.js";
import { logger } from "../../lib/logger.js";

export const interactionCreateEvent: BotEvent = {
  name: "interactionCreate",
  async execute(interaction: Interaction) {
    // ── Slash Commands ─────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const client = interaction.client as ModeraxClient;
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        await interaction.reply({
          embeds: [dangerEmbed("Commande inconnue", "Cette commande n'est pas disponible.")],
          ephemeral: true,
        });
        return;
      }

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, "[Moderax] Erreur commande");
        const embed = dangerEmbed("Erreur interne", "Une erreur est survenue. Réessayez dans un instant.");
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => null);
        } else {
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
        }
      }
      return;
    }

    // ── Button interactions ────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;

      if (btn.customId.startsWith("captcha:")) {
        await handleCaptchaButton(btn).catch((err) => logger.error({ err }, "[Captcha] Button error"));
        return;
      }
      if (btn.customId.startsWith("ticket:close:")) {
        await handleTicketClose(btn).catch((err) => logger.error({ err }, "[Ticket] Close error"));
        return;
      }
      if (btn.customId.startsWith("giveaway:enter:")) {
        await handleGiveawayButton(btn).catch((err) => logger.error({ err }, "[Giveaway] Button error"));
        return;
      }
      if (btn.customId.startsWith("suggest:up:") || btn.customId.startsWith("suggest:down:")) {
        await handleSuggestVote(btn).catch((err) => logger.error({ err }, "[Suggest] Vote error"));
        return;
      }
    }

    // ── Modal interactions ─────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const modal = interaction as ModalSubmitInteraction;
      if (modal.customId.startsWith("captcha_modal:")) {
        await handleCaptchaModal(modal).catch((err) => logger.error({ err }, "[Captcha] Modal error"));
        return;
      }
    }
  },
};
