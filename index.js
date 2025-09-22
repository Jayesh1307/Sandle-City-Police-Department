// index.js
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
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
  if (interaction.isChatInputCommand() && interaction.commandName === "rank") {
    const targetUser = interaction.options.getUser("user");

    // Check allowed role
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!member.roles.cache.has(process.env.ALLOWED_ROLE)) {
      return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
    }

    try {
      // Get ranks from Roblox group
      const callerRank = await noblox.getRank(process.env.GROUP_ID, interaction.user.id);
      const roles = await noblox.getRoles(process.env.GROUP_ID);

      // Filter ranks below caller's rank
      const availableRanks = roles.filter(r => r.rankNumber < callerRank);

      // Create dropdown menu
      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`promote_${targetUser.id}`)
          .setPlaceholder("Select rank")
          .addOptions(
            availableRanks.map(r => ({ label: r.name, value: r.rankNumber.toString() }))
          )
      );

      await interaction.reply({ content: `Select the rank for ${targetUser.tag}:`, components: [menu], ephemeral: true });
    } catch (err) {
      console.error(err);
      interaction.reply({ content: "Error fetching ranks from Roblox.", ephemeral: true });
    }
  }

  // Handle select menu interaction
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("promote_")) {
    const targetUserId = interaction.customId.split("_")[1];
    const selectedRank = parseInt(interaction.values[0]);

    try {
      const targetUser = await client.users.fetch(targetUserId);
      const callerRank = await noblox.getRank(process.env.GROUP_ID, interaction.user.id);

      if (selectedRank >= callerRank) {
        return interaction.update({ content: "You cannot promote to a rank equal or higher than your own.", components: [], ephemeral: true });
      }

      const robloxId = await noblox.getIdFromUsername(targetUser.username);
      await noblox.setRank(process.env.GROUP_ID, robloxId, selectedRank);

      await interaction.update({ content: `${targetUser.username} has been promoted successfully.`, components: [], ephemeral: true });

      // Log in logs channel
      const logsChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
      logsChannel.send(`${interaction.user.tag} promoted ${targetUser.tag} to rank ${selectedRank}.`);
    } catch (err) {
      console.error(err);
      interaction.update({ content: "An error occurred while promoting.", components: [], ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
