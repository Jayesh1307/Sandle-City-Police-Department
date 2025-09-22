import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import express from "express";
import "dotenv/config";

// ----------------- DISCORD CLIENT -----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ----------------- SLASH COMMAND SETUP -----------------
const commands = [
  {
    name: "ping",
    description: "Replies with Pong!",
  },
  {
    name: "promote",
    description: "Promotes a user in Roblox (example).",
    options: [
      {
        name: "username",
        type: 3, // string
        description: "Roblox username",
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("🔄 Refreshing slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("✅ Slash commands registered globally.");
  } catch (err) {
    console.error(err);
  }
})();

// ----------------- COMMAND HANDLER -----------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    await interaction.reply("🏓 Pong!");
  }

  if (commandName === "promote") {
    const username = interaction.options.getString("username");
    // TODO: Add Roblox promote logic here
    await interaction.reply(`✅ ${username} has been promoted!`);
  }
});

// ----------------- EXPRESS KEEP-ALIVE -----------------
const app = express();
app.get("/", (req, res) => res.send("✅ Bot is running!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server listening on port ${PORT}`));

// ----------------- LOGIN -----------------
client.login(process.env.DISCORD_TOKEN);
