import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import fetch from "node-fetch";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const GROUP_ID = process.env.GROUP_ID;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID; // set this in env

// Fetch Roblox group roles
async function getRoles() {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`);
  const data = await res.json();
  return data.roles;
}

// Promote or demote user
async function setRank(userId, roleId) {
  const res = await fetch(`https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
    },
    body: JSON.stringify({ roleId }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to set rank: ${errorText}`);
  }
  return await res.json();
}

// Slash command with autocomplete
const commands = [
  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Set a user’s rank in the Roblox group")
    .addStringOption(option =>
      option.setName("user")
        .setDescription("Roblox username")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("rank")
        .setDescription("Rank to set")
        .setRequired(true)
        .setAutocomplete(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Commands registered.");
  } catch (err) {
    console.error(err);
  }
})();

client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === "rank") {
      const focusedValue = interaction.options.getFocused();
      const roles = await getRoles();
      const filtered = roles.filter(role =>
        role.name.toLowerCase().includes(focusedValue.toLowerCase())
      );
      await interaction.respond(
        filtered.map(role => ({ name: role.name, value: String(role.id) }))
      );
    }
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "rank") {
      await interaction.deferReply({ ephemeral: true });

      const username = interaction.options.getString("user");
      const roleId = parseInt(interaction.options.getString("rank"));

      try {
        // Get target user ID
        const userRes = await fetch(`https://api.roblox.com/users/get-by-username?username=${username}`);
        const userData = await userRes.json();
        if (!userData.Id) throw new Error("Invalid Roblox username.");
        const userId = userData.Id;

        // Get group roles
        const roles = await getRoles();

        // Get target's current role
        const targetRes = await fetch(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
        const targetData = await targetRes.json();
        const targetGroup = targetData.data.find(g => g.group.id == GROUP_ID);
        const targetRole = targetGroup?.role;

        // Get executor's linked Roblox account (you may need to connect your verification system here)
        // For now, assume executor can't promote/demote equal or higher roles
        const executorRole = { rank: 255 }; // Replace with actual verification system

        if (targetRole && targetRole.rank >= executorRole.rank) {
          return await interaction.editReply(`❌ You cannot change the rank of someone equal or higher than you.`);
        }

        // Get target role name
        const roleName = roles.find(r => r.id === roleId)?.name || "Unknown";

        // Set new rank
        await setRank(userId, roleId);

        await interaction.editReply(`✅ Changed **${username}** to **${roleName}**.`);

        // Log action
        const logChannel = await client.channels.fetch(LOGS_CHANNEL_ID);
        if (logChannel) {
          logChannel.send(`📌 **${interaction.user.tag}** changed **${username}** to **${roleName}**.`);
        }

      } catch (err) {
        console.error(err);
        await interaction.editReply(`❌ Error: ${err.message}`);
      }
    }
  }
});

client.login(DISCORD_TOKEN);
