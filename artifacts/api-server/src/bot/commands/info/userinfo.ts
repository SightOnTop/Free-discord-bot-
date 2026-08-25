import { SlashCommandBuilder, EmbedBuilder, type GuildMember } from "discord.js";
import type { Command } from "../../types.js";
import { getUserWarnings } from "../../utils/dbops.js";
import { discordTimestamp } from "../../utils/time.js";

export const userinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Informations sur un utilisateur")
    .addUserOption((o) =>
      o.setName("utilisateur").setDescription("Utilisateur (vous-même par défaut)").setRequired(false)
    ),

  async execute(interaction) {
    const target = (interaction.options.getMember("utilisateur") as GuildMember | null)
      ?? (interaction.member as GuildMember);
    await interaction.deferReply({ ephemeral: true });

    const warns = await getUserWarnings(interaction.guild!.id, target.id).catch(() => []);

    const roles = target.roles.cache
      .filter((r) => r.id !== interaction.guild!.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => `${r}`)
      .slice(0, 10)
      .join(", ") || "Aucun";

    const displayColor = target.displayHexColor === "#000000"
      ? 0x636efa
      : (target.displayHexColor as `#${string}`);

    const flags = target.user.flags?.toArray() ?? [];
    const badges = flags.length > 0
      ? flags.map((f) => `\`${f}\``).join(", ")
      : "Aucun";

    const embed = new EmbedBuilder()
      .setColor(displayColor)
      .setTitle(`👤 ${target.user.username}`)
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🆔 ID",              value: `\`${target.id}\``,                                                      inline: true  },
        { name: "🤖 Bot",             value: target.user.bot ? "Oui" : "Non",                                         inline: true  },
        { name: "📅 Compte créé",     value: discordTimestamp(target.user.createdAt, "D"),                             inline: true  },
        { name: "📥 Rejoint le",      value: target.joinedAt ? discordTimestamp(target.joinedAt, "D") : "Inconnu",     inline: true  },
        { name: "⚠️ Avertissements",  value: `${warns.length}`,                                                        inline: true  },
        { name: "🎖️ Badges",          value: badges,                                                                   inline: true  },
        { name: "🎭 Rôles",           value: roles,                                                                    inline: false },
      )
      .setFooter({ text: "Moderax • Informations utilisateur" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export const serverinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Informations sur le serveur"),

  async execute(interaction) {
    const guild = interaction.guild!;
    await guild.fetch();
    await interaction.deferReply({ ephemeral: true });

    const verificationLabels = ["Aucune", "Faible", "Moyenne", "Haute", "Très haute"];
    const boostTiers = ["Niveau 0", "Niveau 1", "Niveau 2", "Niveau 3"];

    const embed = new EmbedBuilder()
      .setColor(0x0d0d0d)
      .setTitle(`🏰 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "🆔 ID",                 value: `\`${guild.id}\``,                                                         inline: true },
        { name: "👑 Propriétaire",        value: `<@${guild.ownerId}>`,                                                     inline: true },
        { name: "📅 Créé le",            value: discordTimestamp(guild.createdAt, "D"),                                    inline: true },
        { name: "👥 Membres",            value: `${guild.memberCount}`,                                                    inline: true },
        { name: "💬 Salons",             value: `${guild.channels.cache.size}`,                                            inline: true },
        { name: "🎭 Rôles",             value: `${guild.roles.cache.size}`,                                               inline: true },
        { name: "😀 Emojis",            value: `${guild.emojis.cache.size}`,                                              inline: true },
        { name: "🔒 Vérification",       value: verificationLabels[guild.verificationLevel] ?? `${guild.verificationLevel}`, inline: true },
        { name: "💎 Boosts",             value: `${guild.premiumSubscriptionCount ?? 0} (${boostTiers[guild.premiumTier] ?? "Nv. " + guild.premiumTier})`, inline: true },
      )
      .setFooter({ text: "Moderax • Informations serveur" })
      .setTimestamp();

    if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1_024 }));

    await interaction.editReply({ embeds: [embed] });
  },
};

export const botinfo: Command = {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("Informations et statistiques sur Moderax"),

  async execute(interaction) {
    const client  = interaction.client;
    const uptime  = process.uptime();
    const h = Math.floor(uptime / 3_600);
    const m = Math.floor((uptime % 3_600) / 60);
    const s = Math.floor(uptime % 60);

    const memMB = (process.memoryUsage().heapUsed / 1_024 / 1_024).toFixed(1);

    const embed = new EmbedBuilder()
      .setColor(0x0d0d0d)
      .setTitle("🛡️ Moderax — Informations")
      .setThumbnail(client.user!.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "🤖 Nom",              value: client.user!.username,          inline: true },
        { name: "🆔 ID",               value: `\`${client.user!.id}\``,       inline: true },
        { name: "🌐 Serveurs",          value: `${client.guilds.cache.size}`,  inline: true },
        { name: "⏱️ Uptime",           value: `${h}h ${m}m ${s}s`,           inline: true },
        { name: "📡 Latence API",       value: `${client.ws.ping}ms`,          inline: true },
        { name: "🧠 Mémoire",           value: `${memMB} MB`,                  inline: true },
        { name: "📦 discord.js",        value: "v14",                          inline: true },
        { name: "⚡ Node.js",           value: process.version,               inline: true },
        {
          name: "🛡️ Fonctionnalités",
          value: "Anti-Nuke • Anti-Spam • Captcha • Tickets • Filtre profanité • Auto-escalade • Niveaux XP • Giveaways • Suggestions • Rappels",
          inline: false,
        },
      )
      .setFooter({ text: "Moderax • PROTÉGER | MODÉRER | SÉCURISER" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
