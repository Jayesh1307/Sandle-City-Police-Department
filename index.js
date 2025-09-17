require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const noblox = require("noblox.js");

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// Environment variables
const GROUP_ID = process.env.GROUP_ID;
const ALLOWED_ROLE = process.env.ALLOWED_ROLE; // Role name or use ID (recommended)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;

// Roblox login function
async function loginRoblox() {
  try {
    await noblox.setCookie(ROBLOX_COOKIE);
    console.log("✅ Logged into Roblox successfully!");
  } catch (err) {
    console.error("❌ Failed to log into Roblox:", err);
    process.exit(1); // Stop bot if Roblox login fails
  }
}

// Register slash commands
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("promote")
      .setDescription("Promote a Roblox user in the group")
      .addStringOption(option =>
        option.setName("username")
          .setDescription("Roblox username")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("demote")
      .setDescription("Demote a Roblox user in the group")
      .addStringOption(option =>
        option.setName("username")
          .setDescription("Roblox username")
          .setRequired(true)
      )
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Slash commands registered!");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
}

// Handle slash command interactions
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const username = interaction.options.getString("username");

  // Role check
  if (!interaction.member.roles.cache.some(r => r.name === ALLOWED_ROLE)) {
    return interaction.reply({ content: "❌ You don't have permission.", ephemeral: true });
  }

  if (interaction.commandName === "promote") {
    try {
      const userId = await noblox.getIdFromUsername(username);
      await noblox.promote(GROUP_ID, userId);
      await interaction.reply(`✅ Promoted ${username} in the group!`);
    } catch (err) {
      await interaction.reply(`❌ Error promoting user: ${err}`);
    }
  }

  if (interaction.commandName === "demote") {
    try {
      const userId = await noblox.getIdFromUsername(username);
      await noblox.demote(GROUP_ID, userId);
      await interaction.reply(`✅ Demoted ${username} in the group!`);
    } catch (err) {
      await interaction.reply(`❌ Error demoting user: ${err}`);
    }
  }
});

// Start bot
(async () => {
  await loginRoblox();
  client.once("clientReady", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await registerCommands();
  });

  client.login(DISCORD_TOKEN);
})();
