import { SlashCommandBuilder, PermissionsBitField, type GuildMember } from "discord.js";
import type { Command } from "../../types.js";
import { openTicket } from "../../systems/ticket.js";
import { dangerEmbed, warningEmbed } from "../../utils/embeds.js";
import { getGuild } from "../../utils/dbops.js";

export const ticket: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Gérer les tickets de support")
    .addSubcommand((s) =>
      s.setName("create").setDescription("Créer un ticket de support")
        .addStringOption((o) => o.setName("sujet").setDescription("Sujet de votre demande").setRequired(false))
    )
    .addSubcommand((s) =>
      s.setName("add").setDescription("Ajouter un utilisateur au ticket actuel")
        .addUserOption((o) => o.setName("utilisateur").setDescription("Utilisateur à ajouter").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("remove").setDescription("Retirer un utilisateur du ticket actuel")
        .addUserOption((o) => o.setName("utilisateur").setDescription("Utilisateur à retirer").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = await getGuild(interaction.guild!.id);

    switch (sub) {
      case "create": {
        if (!config?.ticketCategoryId) {
          await interaction.reply({ embeds: [warningEmbed("Tickets non configurés", "Utilisez `/set ticketcategory` pour configurer la catégorie des tickets.")], ephemeral: true });
          return;
        }

        const subject = interaction.options.getString("sujet");
        await interaction.deferReply({ ephemeral: true });

        const channel = await openTicket(interaction.guild!, interaction.member as GuildMember, subject ?? undefined);

        if (!channel) {
          await interaction.editReply({ embeds: [dangerEmbed("Erreur", "Impossible de créer le ticket. Vérifiez la configuration.")] });
          return;
        }

        const { EmbedBuilder } = await import("discord.js");
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x00d26a).setDescription(`✅ Ticket créé : ${channel}`)],
        });
        break;
      }

      case "add": {
        const target = interaction.options.getMember("utilisateur") as GuildMember | null;
        if (!target) { await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Membre introuvable.")], ephemeral: true }); return; }
        const tc = interaction.channel as import("discord.js").TextChannel | null;
        await tc?.permissionOverwrites.edit(target, {
          ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
        }).catch(() => null);
        await interaction.reply({ embeds: [{ color: 0x00d26a, description: `✅ ${target} ajouté au ticket.` } as never] });
        break;
      }

      case "remove": {
        const target = interaction.options.getMember("utilisateur") as GuildMember | null;
        if (!target) { await interaction.reply({ embeds: [dangerEmbed("Introuvable", "Membre introuvable.")], ephemeral: true }); return; }
        const tc2 = interaction.channel as import("discord.js").TextChannel | null;
        await tc2?.permissionOverwrites.delete(target).catch(() => null);
        await interaction.reply({ embeds: [{ color: 0xff3b30, description: `🚫 ${target} retiré du ticket.` } as never] });
        break;
      }
    }
  },
};
