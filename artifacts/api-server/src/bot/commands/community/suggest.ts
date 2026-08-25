import {
  SlashCommandBuilder, PermissionsBitField, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, type ButtonInteraction,
} from "discord.js";
import type { Command } from "../../types.js";
import { requirePermission, Perms } from "../../utils/permissions.js";
import {
  getGuild, updateGuild, createSuggestion,
  getSuggestionByMessageId, updateSuggestion,
} from "../../utils/dbops.js";
import { successEmbed, dangerEmbed, warningEmbed } from "../../utils/embeds.js";

// Tracks per-message who already voted to prevent duplicates (in-memory per session)
const votedUsers = new Map<string, Set<string>>(); // messageId → Set<userId>

function suggestionEmbed(
  content: string,
  author: string,
  id: number,
  status: string,
  upvotes: number,
  downvotes: number,
  response?: string,
) {
  const statusEmojis: Record<string, string> = { pending: "⏳", approved: "✅", denied: "❌" };
  const statusColors: Record<string, number> = { pending: 0x636efa, approved: 0x00d26a, denied: 0xff3b30 };

  const embed = new EmbedBuilder()
    .setColor(statusColors[status] ?? 0x636efa)
    .setTitle(`💡 Suggestion #${id}`)
    .setDescription(content)
    .addFields(
      { name: "Statut",      value: `${statusEmojis[status] ?? "⏳"} ${status.charAt(0).toUpperCase() + status.slice(1)}`, inline: true },
      { name: "👍 Pour",     value: `${upvotes}`,   inline: true },
      { name: "👎 Contre",   value: `${downvotes}`, inline: true },
    )
    .setAuthor({ name: author })
    .setFooter({ text: "Moderax • Suggestions" })
    .setTimestamp();

  if (response) embed.addFields({ name: "📋 Réponse du staff", value: response });
  return embed;
}

export const suggest: Command = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Gérer les suggestions communautaires")
    .addSubcommand((s) =>
      s.setName("submit").setDescription("Soumettre une suggestion")
        .addStringOption((o) => o.setName("contenu").setDescription("Votre suggestion").setRequired(true).setMaxLength(1_000))
    )
    .addSubcommand((s) =>
      s.setName("approve").setDescription("Approuver une suggestion (staff)")
        .addStringOption((o) => o.setName("message_id").setDescription("ID du message de la suggestion").setRequired(true))
        .addStringOption((o) => o.setName("reponse").setDescription("Réponse / commentaire").setRequired(false))
    )
    .addSubcommand((s) =>
      s.setName("deny").setDescription("Refuser une suggestion (staff)")
        .addStringOption((o) => o.setName("message_id").setDescription("ID du message de la suggestion").setRequired(true))
        .addStringOption((o) => o.setName("reponse").setDescription("Raison du refus").setRequired(false))
    )
    .addSubcommand((s) =>
      s.setName("setchannel").setDescription("Définir le salon des suggestions (admin)")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon des suggestions").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      // ── Submit (any member) ────────────────────────────────────────────────
      case "submit": {
        const config = await getGuild(interaction.guild!.id);
        if (!config?.suggestionChannelId) {
          await interaction.reply({ embeds: [warningEmbed("Suggestions non configurées", "Aucun salon de suggestions défini. Contactez un administrateur.")], ephemeral: true });
          return;
        }

        const content = interaction.options.getString("contenu", true);
        const channel = interaction.guild!.channels.cache.get(config.suggestionChannelId);
        if (!channel?.isTextBased() || channel.isDMBased()) {
          await interaction.reply({ embeds: [dangerEmbed("Erreur", "Le salon des suggestions est invalide.")], ephemeral: true });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        const suggestion = await createSuggestion({
          guildId: interaction.guild!.id,
          userId: interaction.user.id,
          content,
          status: "pending",
          upvotes: 0,
          downvotes: 0,
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`suggest:up:${suggestion.id}`).setLabel("👍 Pour").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`suggest:down:${suggestion.id}`).setLabel("👎 Contre").setStyle(ButtonStyle.Danger),
        );

        const embed = suggestionEmbed(content, interaction.user.username, suggestion.id, "pending", 0, 0);
        const msg = await channel.send({ embeds: [embed], components: [row] });

        await updateSuggestion(suggestion.id, { messageId: msg.id, channelId: channel.id });
        await interaction.editReply({
          embeds: [successEmbed("Suggestion soumise !", `Votre suggestion **#${suggestion.id}** a été envoyée dans ${channel}.`)],
        });
        break;
      }

      // ── Approve / Deny (ManageGuild) ───────────────────────────────────────
      case "approve":
      case "deny": {
        if (!await requirePermission(interaction, Perms.ManageGuild, "Gérer le serveur")) return;

        const messageId = interaction.options.getString("message_id", true).trim();
        const response = interaction.options.getString("reponse") ?? undefined;
        await interaction.deferReply({ ephemeral: true });

        const suggestion = await getSuggestionByMessageId(messageId);
        if (!suggestion) {
          await interaction.editReply({ embeds: [dangerEmbed("Introuvable", "Suggestion introuvable avec cet ID de message.")] });
          return;
        }
        if (suggestion.status !== "pending") {
          await interaction.editReply({ embeds: [dangerEmbed("Déjà traitée", `Cette suggestion est déjà **${suggestion.status}**.`)] });
          return;
        }

        const newStatus = sub === "approve" ? "approved" : "denied";
        await updateSuggestion(suggestion.id, { status: newStatus, response, respondedById: interaction.user.id });

        // Update the original message
        if (suggestion.channelId && suggestion.messageId) {
          const channel = interaction.guild!.channels.cache.get(suggestion.channelId);
          if (channel?.isTextBased() && !channel.isDMBased()) {
            const msg = await channel.messages.fetch(suggestion.messageId).catch(() => null);
            if (msg) {
              const updated = suggestionEmbed(
                suggestion.content,
                `Utilisateur (${suggestion.userId})`,
                suggestion.id,
                newStatus,
                suggestion.upvotes,
                suggestion.downvotes,
                response,
              );
              // Remove vote buttons once decided
              await msg.edit({ embeds: [updated], components: [] });
            }
          }
        }

        await interaction.editReply({
          embeds: [successEmbed(
            `Suggestion ${sub === "approve" ? "approuvée ✅" : "refusée ❌"}`,
            `Suggestion **#${suggestion.id}** mise à jour.`,
          )],
        });
        break;
      }

      // ── Set channel (Administrator) ────────────────────────────────────────
      case "setchannel": {
        if (!await requirePermission(interaction, Perms.Administrator, "Administrateur")) return;
        const channel = interaction.options.getChannel("salon", true);
        await updateGuild(interaction.guild!.id, { suggestionChannelId: channel.id });
        await interaction.reply({
          embeds: [successEmbed("Salon configuré", `Salon des suggestions → ${channel}`)],
          ephemeral: true,
        });
        break;
      }
    }
  },
};

// ── Vote handler (called from interactionCreate) ──────────────────────────────
export async function handleSuggestVote(interaction: ButtonInteraction) {
  const parts = interaction.customId.split(":");
  const type = parts[1]; // "up" | "down"
  const suggestionId = parseInt(parts[2] ?? "0", 10);
  if (!suggestionId || (type !== "up" && type !== "down")) return;

  // Duplicate vote prevention
  const key = interaction.message.id;
  if (!votedUsers.has(key)) votedUsers.set(key, new Set());
  const voters = votedUsers.get(key)!;
  if (voters.has(interaction.user.id)) {
    await interaction.reply({ content: "⚠️ Vous avez déjà voté pour cette suggestion.", ephemeral: true });
    return;
  }
  voters.add(interaction.user.id);

  const suggestion = await getSuggestionByMessageId(interaction.message.id);
  if (!suggestion) {
    await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Suggestion introuvable.")], ephemeral: true });
    return;
  }
  if (suggestion.status !== "pending") {
    await interaction.reply({ embeds: [dangerEmbed("Clôturée", "Cette suggestion a déjà été traitée.")], ephemeral: true });
    return;
  }

  const newUpvotes   = suggestion.upvotes   + (type === "up"   ? 1 : 0);
  const newDownvotes = suggestion.downvotes + (type === "down" ? 1 : 0);
  await updateSuggestion(suggestionId, { upvotes: newUpvotes, downvotes: newDownvotes });

  const updatedEmbed = suggestionEmbed(
    suggestion.content,
    `Utilisateur`,
    suggestionId,
    suggestion.status,
    newUpvotes,
    newDownvotes,
  );
  await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => null);
  await interaction.reply({
    content: type === "up" ? "✅ Vote **Pour** enregistré !" : "✅ Vote **Contre** enregistré !",
    ephemeral: true,
  });
}
