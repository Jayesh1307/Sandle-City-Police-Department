// index.js
import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import noblox from "noblox.js";

// --- Load environment variables ---
const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  GROUP_ID,
  ROBLOX_COOKIE,
  ALLOWED_CHANNEL_ID,
  ALLOWED_ROLE,
  LOGS_CHANNEL_ID
} = process.env;

// Basic validation
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID || !GROUP_ID || !ROBLOX_COOKIE) {
  console.error("❌ Missing required environment variables. Check your .env file.");
  process.exit(1);
}

// --- Initialize Discord client ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- Roblox login ---
async function startNoblox() {
  try {
    await noblox.setCookie(ROBLOX_COOKIE);
    console.log("✅ Logged into Roblox successfully!");
  } catch (err) {
    console.error("❌ Roblox login failed:", err);
    process.exit(1);
  }
}

// --- Register slash commands ---
async function registerCommands() {
  const commands = [
    {
      name: "promote",
      description: "Promote a user in the Roblox group",
      options: [
        { name: "username", type: 3, description: "Roblox username", required: true }
      ]
    },
    {
      name: "demote",
      description: "Demote a user in the Roblox group",
      options: [
        { name: "username", type: 3, description: "Roblox username", required: true }
      ]
    },
    {
      name: "rank",
      description: "Set a user's rank in the Roblox group",
      options: [
        { name: "username", type: 3, description: "Roblox username", required: true },
        { name: "rank", type: 3, description: "Rank name", required: true }
      ]
    }
  ];

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  try {
    console.log("📡 Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered successfully!");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

// --- Handle interactions ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Channel restriction
  if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({ content: "❌ You can only use this command in the designated channel.", ephemeral: true });
  }

  // Role restriction
  if (!interaction.member.roles.cache.has(ALLOWED_ROLE)) {
    return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });
  }

  const { commandName, options, user, guild } = interaction;

  try {
    if (commandName === "promote") {
      const username = options.getString("username");
      const userId = await noblox.getIdFromUsername(username);
      const oldRank = await noblox.getRankNameInGroup(GROUP_ID, userId);
      const response = await noblox.promote(GROUP_ID, userId);
      const newRank = response.newRole.name;

      await interaction.reply(`✅ Promoted **${username}** from **${oldRank}** → **${newRank}**`);

      // Log
      const logChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logChannel) logChannel.send(`📈 **${user.tag}** promoted **${username}** from **${oldRank}** → **${newRank}**`);
    }

    if (commandName === "demote") {
      const username = options.getString("username");
      const userId = await noblox.getIdFromUsername(username);
      const oldRank = await noblox.getRankNameInGroup(GROUP_ID, userId);
      const response = await noblox.demote(GROUP_ID, userId);
      const newRank = response.newRole.name;

      await interaction.reply(`✅ Demoted **${username}** from **${oldRank}** → **${newRank}**`);

      const logChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logChannel) logChannel.send(`📉 **${user.tag}** demoted **${username}** from **${oldRank}** → **${newRank}**`);
    }

    if (commandName === "rank") {
      const username = options.getString("username");
      const rankName = options.getString("rank");
      const userId = await noblox.getIdFromUsername(username);

      const roles = await noblox.getRoles(GROUP_ID);
      const targetRole = roles.find(r => r.name.toLowerCase() === rankName.toLowerCase());
      if (!targetRole) return interaction.reply({ content: "❌ Rank not found in group.", ephemeral: true });

      const oldRank = await noblox.getRankNameInGroup(GROUP_ID, userId);
      await noblox.setRank(GROUP_ID, userId, targetRole.rank);

      await interaction.reply(`✅ Set rank of **${username}** from **${oldRank}** → **${targetRole.name}**`);

      const logChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logChannel) logChannel.send(`⚡ **${user.tag}** set **${username}**'s rank from **${oldRank}** → **${targetRole.name}**`);
    }

  } catch (err) {
    console.error(err);
    interaction.reply({ content: "❌ Error executing command. Check logs.", ephemeral: true });
  }
});

// --- Discord ready ---
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// --- Start bot ---
import express from "express";
const app = express();

app.get("/", (req, res) => res.send("✅ Bot is running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 HTTP server listening on port ${PORT}`));

(async () => {
  await startNoblox();
  await registerCommands();
  client.login(DISCORD_TOKEN);
})();
