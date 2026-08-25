import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../types.js";

const EIGHT_BALL = [
  "C'est certain.", "C'est décidément ainsi.", "Sans aucun doute.",
  "Oui, absolument.", "Tu peux compter dessus.", "Je vois que oui.",
  "Très probablement.", "Les perspectives s'annoncent bien.", "Oui.", "Les signes pointent vers oui.",
  "La réponse est floue, réessaie.", "Demande à nouveau plus tard.", "Je ne peux pas te répondre maintenant.",
  "Difficile à prédire.", "Je me concentre, redemande plus tard.",
  "Non.", "Mes sources disent non.", "Les perspectives ne sont pas bonnes.",
  "Très douteux.", "Absolument non.",
];

const CHOICE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export const eightBall: Command = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Posez une question à la boule magique")
    .addStringOption((o) => o.setName("question").setDescription("Votre question").setRequired(true)),

  async execute(interaction) {
    const question = interaction.options.getString("question", true);
    const answer = EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)]!;
    const isPositive = EIGHT_BALL.indexOf(answer) < 10;
    const isNeutral = EIGHT_BALL.indexOf(answer) < 15 && EIGHT_BALL.indexOf(answer) >= 10;

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(isPositive ? 0x00d26a : isNeutral ? 0xff9f0a : 0xff3b30)
        .setTitle("🎱 Boule Magique")
        .addFields(
          { name: "❓ Question", value: question },
          { name: "🔮 Réponse", value: `**${answer}**` },
        )
        .setFooter({ text: "Moderax • Boule magique" })
        .setTimestamp()],
    });
  },
};

export const dice: Command = {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Lancer un dé")
    .addIntegerOption((o) =>
      o.setName("faces").setDescription("Nombre de faces (6 par défaut)").setMinValue(2).setMaxValue(1000).setRequired(false)
    ),

  async execute(interaction) {
    const faces = interaction.options.getInteger("faces") ?? 6;
    const result = Math.floor(Math.random() * faces) + 1;
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x636efa)
        .setTitle("🎲 Lancer de dé")
        .setDescription(`**${result}** / ${faces}`)
        .setFooter({ text: `Moderax • Dé à ${faces} faces` })],
    });
  },
};

export const coinflip: Command = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Lancer une pièce — Pile ou Face ?"),

  async execute(interaction) {
    const result = Math.random() < 0.5 ? "🪙 Pile" : "🔵 Face";
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("🪙 Pile ou Face ?")
        .setDescription(`Résultat : **${result}**`)
        .setFooter({ text: "Moderax • Pile ou Face" })],
    });
  },
};

export const choose: Command = {
  data: new SlashCommandBuilder()
    .setName("choose")
    .setDescription("Choisir une option parmi plusieurs")
    .addStringOption((o) => o.setName("options").setDescription("Options séparées par des virgules (ex: chat, chien, oiseau)").setRequired(true)),

  async execute(interaction) {
    const raw = interaction.options.getString("options", true);
    const opts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (opts.length < 2) {
      await interaction.reply({ content: "⚠️ Donnez au moins 2 options séparées par des virgules.", ephemeral: true });
      return;
    }
    const chosen = opts[Math.floor(Math.random() * opts.length)]!;
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x636efa)
        .setTitle("🤔 Choix aléatoire")
        .addFields(
          { name: "Options", value: opts.map((o, i) => `${CHOICE_EMOJIS[i] ?? "•"} ${o}`).join("\n") },
          { name: "✅ Choix", value: `**${chosen}**` },
        )
        .setFooter({ text: "Moderax • Choix aléatoire" })],
    });
  },
};

export const avatar: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Afficher l'avatar d'un utilisateur")
    .addUserOption((o) => o.setName("utilisateur").setDescription("Utilisateur (vous-même par défaut)").setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser("utilisateur") ?? interaction.user;
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x0d0d0d)
        .setTitle(`🖼️ Avatar de ${target.username}`)
        .setImage(target.displayAvatarURL({ size: 1024 }))
        .addFields(
          { name: "PNG", value: `[Télécharger](${target.displayAvatarURL({ size: 1024, extension: "png" })})`, inline: true },
          { name: "WebP", value: `[Télécharger](${target.displayAvatarURL({ size: 1024, extension: "webp" })})`, inline: true },
        )
        .setFooter({ text: "Moderax • Avatar" })],
    });
  },
};

export const rps: Command = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDescription("Pierre, Feuille, Ciseaux contre Moderax !")
    .addStringOption((o) =>
      o.setName("choix").setDescription("Votre choix").setRequired(true)
        .addChoices(
          { name: "🪨 Pierre", value: "pierre" },
          { name: "📄 Feuille", value: "feuille" },
          { name: "✂️ Ciseaux", value: "ciseaux" },
        )
    ),

  async execute(interaction) {
    const choices = ["pierre", "feuille", "ciseaux"] as const;
    const emojis = { pierre: "🪨", feuille: "📄", ciseaux: "✂️" };
    const userChoice = interaction.options.getString("choix", true) as (typeof choices)[number];
    const botChoice = choices[Math.floor(Math.random() * 3)]!;

    let result: string;
    let color: number;
    if (userChoice === botChoice) {
      result = "Égalité ! 🤝"; color = 0xff9f0a;
    } else if (
      (userChoice === "pierre" && botChoice === "ciseaux") ||
      (userChoice === "feuille" && botChoice === "pierre") ||
      (userChoice === "ciseaux" && botChoice === "feuille")
    ) {
      result = "Tu gagnes ! 🎉"; color = 0x00d26a;
    } else {
      result = "Moderax gagne ! 😈"; color = 0xff3b30;
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(color)
        .setTitle("🎮 Pierre, Feuille, Ciseaux")
        .addFields(
          { name: `${interaction.user.username}`, value: `${emojis[userChoice]} ${userChoice}`, inline: true },
          { name: "VS", value: "⚡", inline: true },
          { name: "Moderax", value: `${emojis[botChoice]} ${botChoice}`, inline: true },
          { name: "Résultat", value: `**${result}**` },
        )
        .setFooter({ text: "Moderax • Jeu" })],
    });
  },
};

export const calc: Command = {
  data: new SlashCommandBuilder()
    .setName("calc")
    .setDescription("Calculer une expression mathématique simple")
    .addStringOption((o) => o.setName("expression").setDescription("Ex: 2 + 2, 10 * 5, 100 / 4").setRequired(true)),

  async execute(interaction) {
    const expr = interaction.options.getString("expression", true);
    // Safe evaluation: only allow numbers and basic operators
    if (!/^[\d\s+\-*/().]+$/.test(expr)) {
      await interaction.reply({ content: "⚠️ Expression invalide. Utilisez uniquement +, -, *, /, ( ).", ephemeral: true });
      return;
    }
    try {
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${expr})`)() as number;
      if (typeof result !== "number" || !isFinite(result)) throw new Error("Résultat invalide");
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x636efa)
          .setTitle("🧮 Calculatrice")
          .addFields(
            { name: "Expression", value: `\`${expr}\``, inline: true },
            { name: "Résultat", value: `**${result}**`, inline: true },
          )
          .setFooter({ text: "Moderax • Calculatrice" })],
      });
    } catch {
      await interaction.reply({ content: "⚠️ Expression invalide.", ephemeral: true });
    }
  },
};
