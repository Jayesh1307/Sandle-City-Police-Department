import { Client, GatewayIntentBits, SlashCommandBuilder, Routes } from "discord.js";
import { REST } from "@discordjs/rest";
import noblox from "noblox.js";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

// Express server (keeps bot alive for uptime monitors)
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(process.env.PORT || 3000, () => console.log("Express server running"));

// Discord bot
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Slash command definition
const commands = [
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Promote a user to a specific rank")
    .addUserOption(option =>
      option.setName("user")
            .setDescription("User to promote")
            .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("rank")
            .setDescription("Rank to assign")
            .setRequired(true)
            .setAutocomplete(true) // optional: dropdown/autocomplete
    )
].map(cmd => cmd.toJSON());

(async () => {
  try {
    console.log("Registering commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Commands registered!");
  } catch (err) {
    console.error(err);
  }
})();

// Event handling
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "rank") {
    const targetUser = interaction.options.getUser("user");
    const targetRank = interaction.options.getString("rank");

    try {
      const callerRank = await noblox.getRank(process.env.GROUP_ID, interaction.user.id);
      const newRankId = await noblox.getRoles(process.env.GROUP_ID)
                                  .then(roles => roles.find(r => r.name === targetRank)?.rankNumber);

      if (!newRankId) {
        return interaction.reply({ content: "Invalid rank.", ephemeral: true });
      }

      if (newRankId >= callerRank) {
        return interaction.reply({ content: "You cannot promote to a rank equal or higher than your own.", ephemeral: true });
      }

      // Promote user
      const robloxId = await noblox.getIdFromUsername(targetUser.username);
      await noblox.setRank(process.env.GROUP_ID, robloxId, newRankId);

      interaction.reply({ content: `${targetUser.username} has been promoted to ${targetRank}.` });

      // Log promotion
      const logsChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
      logsChannel.send(`${interaction.user.tag} promoted ${targetUser.tag} to ${targetRank}.`);

    } catch (error) {
      console.error(error);
      interaction.reply({ content: "An error occurred while promoting.", ephemeral: true });
    }
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);
