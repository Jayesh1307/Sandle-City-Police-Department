// index.js
require("dotenv").config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} = require("discord.js");
const express = require("express");
const noblox = require("noblox.js");

// --- EXPRESS KEEP-ALIVE ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is running! 🚔"));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// --- DISCORD CLIENT ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await noblox.setCookie(process.env.ROBLOX_COOKIE); // Authenticate Roblox
  console.log("✅ Logged into Roblox");

  // Register slash command
  const commands = [
    new SlashCommandBuilder()
      .setName("rank")
      .setDescription("Change a user's rank in the Roblox group")
      .addUserOption(option =>
        option.setName("user")
          .setDescription("The Discord user to rank")
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName("rank")
          .setDescription("The Roblox rank to set")
          .setRequired(true)
          .addChoices(
            { name: "Cadet", value: "Cadet" },
            { name: "Officer", value: "Officer" },
            { name: "Sergeant", value: "Sergeant" },
            { name: "Lieutenant", value: "Lieutenant" },
            { name: "Captain", value: "Captain" }
            // 👉 You can add more ranks here
          )
      )
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log("✅ Slash command /rank registered");
});

// --- SLASH COMMAND HANDLER ---
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== "rank") return;

  // ✅ Role check
  const allowedRole = interaction.guild.roles.cache.get(process.env.ALLOWED_ROLE);
  if (!interaction.member.roles.cache.has(process.env.ALLOWED_ROLE)) {
    return interaction.reply({ content: "❌ You don’t have permission to use this command.", ephemeral: true });
  }

  const targetUser = interaction.options.getUser("user");
  const newRankName = interaction.options.getString("rank");

  // ❌ Prevent self rank
  if (targetUser.id === interaction.user.id) {
    return interaction.reply({ content: "❌ You cannot change your own rank.", ephemeral: true });
  }

  try {
    // Roblox info
    const groupId = Number(process.env.GROUP_ID);

    // Convert Discord user to Roblox (You might need a binding system)
    // For now, assume Discord username == Roblox username
    const robloxUsername = targetUser.username;
    const robloxId = await noblox.getIdFromUsername(robloxUsername);

    const executorRobloxId = await noblox.getIdFromUsername(interaction.user.username);
    const executorRank = await noblox.getRankInGroup(groupId, executorRobloxId);
    const targetRank = await noblox.getRankInGroup(groupId, robloxId);

    // Prevent promoting above self or to equal rank
    if (newRankName >= executorRank) {
      return interaction.reply({ content: "❌ You cannot promote someone to your rank or higher.", ephemeral: true });
    }

    if (targetRank >= executorRank) {
      return interaction.reply({ content: "❌ You cannot change the rank of someone equal to or above you.", ephemeral: true });
    }

    // Get the new role ID by name
    const roles = await noblox.getRoles(groupId);
    const newRole = roles.find(r => r.name.toLowerCase() === newRankName.toLowerCase());

    if (!newRole) {
      return interaction.reply({ content: "❌ That rank does not exist in the group.", ephemeral: true });
    }

    // Change the rank
    await noblox.setRank(groupId, robloxId, newRole.rank);

    // Reply to executor
    await interaction.reply(`✅ ${robloxUsername} has been ranked to **${newRole.name}**.`);

    // Send log
    const logChannel = client.channels.cache.get(process.env.LOGS_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(
        `📢 **Rank Change**\n👤 Executor: ${interaction.user.tag}\n🎯 Target: ${robloxUsername}\n📌 New Rank: ${newRole.name}`
      );
    }

  } catch (error) {
    console.error(error);
    return interaction.reply({ content: "❌ Something went wrong. Please check the username or permissions.", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
