import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits } from "discord.js";
import noblox from "noblox.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Load env vars
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

// Login to Roblox
async function startNoblox() {
  try {
    await noblox.setCookie(ROBLOX_COOKIE);
    console.log("✅ Logged into Roblox");
  } catch (err) {
    console.error("❌ Roblox login failed:", err);
  }
}

// Register slash commands
async function registerCommands() {
  const commands = [
    {
      name: "promote",
      description: "Promote a user in the Roblox group",
      options: [
        {
          name: "username",
          type: 3, // STRING
          description: "The Roblox username to promote",
          required: true
        }
      ]
    },
    {
      name: "demote",
      description: "Demote a user in the Roblox group",
      options: [
        {
          name: "username",
          type: 3,
          description: "The Roblox username to demote",
          required: true
        }
      ]
    },
    {
      name: "rank",
      description: "Set a user's rank in the Roblox group",
      options: [
        {
          name: "username",
          type: 3,
          description: "The Roblox username",
          required: true
        },
        {
          name: "rank",
          type: 3,
          description: "The rank name to set",
          required: true,
          autocomplete: true
        }
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
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

// Handle interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // ✅ Channel restriction
  if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
    return interaction.reply({ content: "❌ You can only use this command in the designated channel.", ephemeral: true });
  }

  // ✅ Role restriction
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

      // Log to logs channel
      const logChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logChannel) {
        logChannel.send(`📈 **${user.tag}** promoted **${username}** from **${oldRank}** → **${newRank}**`);
      }
    }

    if (commandName === "demote") {
      const username = options.getString("username");
      const userId = await noblox.getIdFromUsername(username);
      const oldRank = await noblox.getRankNameInGroup(GROUP_ID, userId);
      const response = await noblox.demote(GROUP_ID, userId);
      const newRank = response.newRole.name;

      await interaction.reply(`✅ Demoted **${username}** from **${oldRank}** → **${newRank}**`);

      // Log to logs channel
      const logChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logChannel) {
        logChannel.send(`📉 **${user.tag}** demoted **${username}** from **${oldRank}** → **${newRank}**`);
      }
    }

    if (commandName === "rank") {
      const username = options.getString("username");
      const rankName = options.getString("rank");
      const userId = await noblox.getIdFromUsername(username);

      // Get all roles in the group
      const roles = await noblox.getRoles(GROUP_ID);
      const targetRole = roles.find(r => r.name.toLowerCase() === rankName.toLowerCase());
      if (!targetRole) return interaction.reply({ content: "❌ Rank not found in group.", ephemeral: true });

      const oldRank = await noblox.getRankNameInGroup(GROUP_ID, userId);
      await noblox.setRank(GROUP_ID, userId, targetRole.rank);

      await interaction.reply(`✅ Set rank of **${username}** from **${oldRank}** → **${targetRole.name}**`);

      // Log to logs channel
      const logChannel = guild.channels.cache.get(LOGS_CHANNEL_ID);
      if (logChannel) {
        logChannel.send(`⚡ **${user.tag}** set **${username}**'s rank from **${oldRank}** → **${targetRole.name}**`);
      }
    }

  } catch (err) {
    console.error(err);
    interaction.reply({ content: "❌ Error executing command. Check logs.", ephemeral: true });
  }
});

// Start bot
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

startNoblox();
registerCommands();
client.login(DISCORD_TOKEN);
