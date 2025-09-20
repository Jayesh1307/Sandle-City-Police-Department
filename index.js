import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import noblox from "noblox.js";
import "dotenv/config";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const GROUP_ID = parseInt(process.env.GROUP_ID);

// ========== REGISTER COMMAND ==========
const commands = [
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Manage group ranks")
    .addSubcommand(sub =>
      sub
        .setName("set")
        .setDescription("Set a user's rank in the group")
        .addStringOption(opt =>
          opt.setName("username")
            .setDescription("Roblox username")
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("rank")
            .setDescription("Rank to assign")
            .setAutocomplete(true) // ✅ autocomplete enabled
            .setRequired(true)
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered!");
  } catch (err) {
    console.error("❌ Error registering commands:", err);
  }
})();

// ========== BOT READY ==========
client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ========== AUTOCOMPLETE HANDLER ==========
client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === "rank") {
      const focused = interaction.options.getFocused();
      try {
        const roles = await noblox.getRoles(GROUP_ID);
        const choices = roles
          .filter(r => r.name.toLowerCase().includes(focused.toLowerCase()))
          .slice(0, 25) // Discord allows max 25 suggestions
          .map(r => ({ name: r.name, value: r.name }));

        await interaction.respond(choices);
      } catch (err) {
        console.error("❌ Autocomplete error:", err);
        await interaction.respond([]);
      }
    }
  }
});

// ========== COMMAND HANDLER ==========
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "rank" && interaction.options.getSubcommand() === "set") {
    const username = interaction.options.getString("username");
    const rankName = interaction.options.getString("rank");

    try {
      const userId = await noblox.getIdFromUsername(username);
      const roles = await noblox.getRoles(GROUP_ID);
      const targetRole = roles.find(r => r.name.toLowerCase() === rankName.toLowerCase());

      if (!targetRole) {
        return interaction.reply({ content: `❌ Rank "${rankName}" not found.`, ephemeral: false });
      }

      // Get executor's Roblox ID (from their Discord ID mapping in your DB or verify system)
      // For now, I’ll assume executor's Roblox username = their Discord nickname
      const executorName = interaction.member.nickname || interaction.user.username;
      const executorId = await noblox.getIdFromUsername(executorName).catch(() => null);

      if (!executorId) {
        return interaction.reply({ content: "❌ Could not determine your Roblox account. Make sure your Discord nickname = Roblox username.", ephemeral: true });
      }

      const executorRank = await noblox.getRankInGroup(GROUP_ID, executorId);
      const targetRankLevel = targetRole.rank;

      // ✅ Prevent promoting/demoting to equal or higher rank
      if (targetRankLevel >= executorRank) {
        return interaction.reply({
          content: "❌ You cannot promote/demote someone to a rank equal to or higher than your own.",
          ephemeral: false
        });
      }

      await noblox.setRank(GROUP_ID, userId, targetRole.rank);

      await interaction.reply({
        content: `✅ Set **${username}** to rank **${targetRole.name}**!`,
        ephemeral: false
      });

    } catch (err) {
      console.error("❌ Rank error:", err);
      await interaction.reply({ content: "❌ Error: " + err.message, ephemeral: false });
    }
  }
});

// ========== LOGIN ==========
(async () => {
  await noblox.setCookie(process.env.ROBLOX_COOKIE);
  console.log("✅ Logged into Roblox successfully!");
  client.login(process.env.DISCORD_TOKEN);
})();
