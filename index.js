// index.js
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import * as noblox from "noblox.js";
import dotenv from "dotenv";

dotenv.config();

// --- EXPRESS SERVER TO KEEP BOT ALIVE ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("Express server running on port 3000"));

// --- LOGIN TO ROBLOX ---
await noblox.setCookie(process.env.ROBLOX_COOKIE);
console.log("Logged in to Roblox!");

// --- DISCORD BOT SETUP ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// --- REGISTER SLASH COMMAND /rank ---
const commands = [
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Promote or demote a user")
    .addUserOption(option => option.setName("user").setDescription("The user to change rank").setRequired(true))
    .addStringOption(option =>
      option
        .setName("rank")
        .setDescription("Select the rank")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log("Slash commands registered!");
  } catch (error) {
    console.error(error);
  }
})();

// --- HANDLE INTERACTIONS ---
client.on("interactionCreate", async interaction => {
  if (interaction.isAutocomplete() && interaction.commandName === "rank") {
    // Fetch ranks dynamically from Roblox
    const focusedValue = interaction.options.getFocused();
    const roles = await noblox.getRoles(parseInt(process.env.GROUP_ID));
    const choices = roles.map(r => r.name).filter(name => name.toLowerCase().includes(focusedValue.toLowerCase()));

    await interaction.respond(
      choices.slice(0, 25).map(name => ({ name, value: name })) // Discord allows max 25
    );
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "rank") {
    const targetUser = interaction.options.getUser("user");
    const targetRankName = interaction.options.getString("rank");

    // Check if user has the allowed role
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(process.env.ALLOWED_ROLE)) {
      return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    }

    try {
      const callerRank = await noblox.getRank(process.env.GROUP_ID, interaction.user.id);
      const roles = await noblox.getRoles(process.env.GROUP_ID);
      const targetRole = roles.find(r => r.name === targetRankName);

      if (!targetRole) return interaction.reply({ content: "Invalid rank.", ephemeral: true });
      if (targetRole.rankNumber >= callerRank)
        return interaction.reply({ content: "You cannot promote to a rank equal or higher than your own.", ephemeral: true });

      const robloxId = await noblox.getIdFromUsername(targetUser.username);
      await noblox.setRank(process.env.GROUP_ID, robloxId, targetRole.rankNumber);

      interaction.reply({ content: `${targetUser.username} has been promoted to ${targetRankName}.` });

      // LOG TO LOGS CHANNEL
      const logsChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
      logsChannel.send(`${interaction.user.tag} promoted ${targetUser.tag} to ${targetRankName}.`);
    } catch (error) {
      console.error(error);
      interaction.reply({ content: "An error occurred while promoting.", ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
