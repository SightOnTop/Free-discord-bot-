import { EmbedBuilder, type ColorResolvable } from "discord.js";

export const Colors = {
  brand:   0x0d0d0d as ColorResolvable,
  success: 0x00d26a as ColorResolvable,
  danger:  0xff3b30 as ColorResolvable,
  warning: 0xff9f0a as ColorResolvable,
  info:    0x636efa as ColorResolvable,
  neutral: 0x2b2d31 as ColorResolvable,
};

const FOOTER = { text: "Moderax • Sécurité & Modération" };

export function successEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`✅ ${title}`)
    .setDescription(description ?? null)
    .setFooter(FOOTER)
    .setTimestamp();
}

export function dangerEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setColor(Colors.danger)
    .setTitle(`🚫 ${title}`)
    .setDescription(description ?? null)
    .setFooter(FOOTER)
    .setTimestamp();
}

export function warningEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setColor(Colors.warning)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description ?? null)
    .setFooter(FOOTER)
    .setTimestamp();
}

export function infoEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setColor(Colors.info)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description ?? null)
    .setFooter(FOOTER)
    .setTimestamp();
}

export function brandEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setColor(Colors.brand)
    .setTitle(title)
    .setDescription(description ?? null)
    .setFooter(FOOTER)
    .setTimestamp();
}

export function modActionEmbed(opts: {
  action:     string;
  target:     string;
  moderator:  string;
  reason?:    string;
  duration?:  string;
  color:      ColorResolvable;
  emoji:      string;
}) {
  const embed = new EmbedBuilder()
    .setColor(opts.color)
    .setTitle(`${opts.emoji} ${opts.action}`)
    .addFields(
      { name: "👤 Utilisateur", value: opts.target,    inline: true },
      { name: "🛡️ Modérateur",  value: opts.moderator, inline: true },
    )
    .setFooter(FOOTER)
    .setTimestamp();

  if (opts.reason)   embed.addFields({ name: "📝 Raison",  value: opts.reason,              inline: false });
  if (opts.duration) embed.addFields({ name: "⏱️ Durée",   value: opts.duration,            inline: true  });

  return embed;
}

// ── Welcome embed sent on guildCreate ────────────────────────────────────────
export function welcomeBotEmbed(botAvatarUrl: string | null): EmbedBuilder[] {
  const main = new EmbedBuilder()
    .setColor(0x0d0d0d)
    .setTitle("🛡️ MODERAX — Bienvenue !")
    .setDescription(
      "Merci de m'avoir invité ! Je suis votre système de modération tout-en-un.\n" +
      "Configurez-moi en quelques minutes avec `/set` et bénéficiez de toutes les fonctionnalités ci-dessous."
    )
    .addFields(
      {
        name: "⚔️ Modération complète",
        value:
          "`/ban` `/unban` `/kick` `/softban`\n" +
          "`/mute` `/unmute` `/timeout` `/untimeout`\n" +
          "`/warn` `/warnings` `/clearwarn` `/clearwarns`\n" +
          "`/clear` `/purge` `/lock` `/unlock` `/slowmode` `/nuke`",
      },
      {
        name: "🤖 Systèmes automatiques",
        value:
          "🛡️ **Anti-Nuke** — Bloque mass-bans, mass-kicks, suppressions massives\n" +
          "🚫 **Anti-Spam** — Détection floods, messages répétitifs → sanction auto\n" +
          "🔒 **Filtre profanité** — Suppression + avertissement automatique\n" +
          "⚡ **Auto-escalade** — 3 warns→timeout 1h • 5→timeout 24h • 7→ban",
      },
      {
        name: "🔐 Vérification & Sécurité",
        value:
          "🔐 **Captcha** — Vérification math à l'arrivée, délai 3 min, rôle automatique\n" +
          "🎭 **Auto-rôle** — Attribution d'un rôle à chaque nouveau membre\n" +
          "🚨 **Signalements** — `/report` envoie un signalement au staff",
      },
      {
        name: "🎫 Tickets",
        value:
          "`/ticket create` — Ouvre un ticket privé\n" +
          "`/ticket add/remove` — Gère les participants\n" +
          "Logs de fermeture dans le salon configuré",
      },
      {
        name: "🎉 Communauté",
        value:
          "`/giveaway start/end/reroll/info` — Giveaways complets avec bouton\n" +
          "`/poll` — Sondages interactifs avec votes en temps réel\n" +
          "`/announce` — Annonces stylisées avec @everyone optionnel\n" +
          "`/suggest submit/approve/deny` — Système de suggestions avec votes\n" +
          "`/remind set/list/cancel` — Rappels personnels",
      },
      {
        name: "⭐ Niveaux & XP",
        value:
          "`/rank` — Voir son niveau et sa progression\n" +
          "`/leaderboard` — Classement XP du serveur\n" +
          "`/resetlevel` — Réinitialiser un niveau (admin)\n" +
          "XP gagné par message (cooldown 1 min), notification de niveau",
      },
      {
        name: "🎮 Fun",
        value: "`/8ball` `/dice` `/coinflip` `/choose` `/avatar` `/rps` `/calc`",
      },
      {
        name: "ℹ️ Informations",
        value: "`/userinfo` `/serverinfo` `/botinfo` `/help`",
      },
    )
    .setFooter({ text: "Moderax • PROTÉGER | MODÉRER | SÉCURISER" })
    .setTimestamp();

  if (botAvatarUrl) main.setThumbnail(botAvatarUrl);

  const setup = new EmbedBuilder()
    .setColor(0x636efa)
    .setTitle("⚡ Démarrage rapide — Configuration recommandée")
    .setDescription("Suivez ces étapes pour activer toutes les protections :")
    .addFields(
      {
        name: "1️⃣ Rôles & Salons essentiels",
        value:
          "`/set muterole @role` — Rôle attribué lors d'un mute\n" +
          "`/set autorole @role` — Rôle donné à chaque nouveau membre\n" +
          "`/set logchannel #salon` — Logs de modération\n" +
          "`/set welcomechannel #salon` — Messages de bienvenue",
      },
      {
        name: "2️⃣ Protection",
        value:
          "`/antinuke enable` — Activer l'Anti-Nuke\n" +
          "`/set antispam true` — Activer l'Anti-Spam\n" +
          "`/automod badword toggle true` — Activer le filtre profanité\n" +
          "`/automod escalation toggle true` — Activer l'auto-escalade",
      },
      {
        name: "3️⃣ Captcha (optionnel)",
        value:
          "`/set captcha true` — Activer la vérification\n" +
          "`/set captcharole @role` — Rôle donné après validation\n" +
          "`/set captchachannel #salon` — Salon du captcha",
      },
      {
        name: "4️⃣ Tickets & Signalements (optionnel)",
        value:
          "`/set ticketcategory #catégorie` — Catégorie des tickets\n" +
          "`/set ticketlogchannel #salon` — Logs de tickets",
      },
      {
        name: "5️⃣ Communauté (optionnel)",
        value:
          "`/suggest setchannel #salon` — Salon des suggestions\n" +
          "Utilisez `/config` à tout moment pour voir la configuration actuelle",
      },
    )
    .setFooter({ text: "Moderax • Utilisez /help pour voir toutes les commandes" });

  return [main, setup];
}
