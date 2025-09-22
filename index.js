// index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import express from 'express';
import noblox from 'noblox.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Allowed Discord role IDs for using rank commands
const ALLOWED_ROLE_IDS = [process.env.ADMIN_ROLE_ID]; // add your role ID here

// Login to Roblox
async function loginRoblox() {
  try {
    const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
    console.log('✅ Logged into Roblox as:', currentUser.UserName);
  } catch (err) {
    console.error('❌ Failed to log in to Roblox:', err);
  }
}

// Register slash commands
const commands = [
  {
    name: 'rank',
    description: 'Assign a Roblox rank to a user',
    options: [
      {
        name: 'username',
        type: 3, // STRING
        description: 'Roblox username',
        required: true,
      },
      {
        name: 'rank',
        type: 4, // INTEGER
        description: 'Roblox rank ID',
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error(err);
  }
}

client.on('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await loginRoblox();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const memberRoles = interaction.member.roles.cache;
  const isAllowed = ALLOWED_ROLE_IDS.some((roleId) => memberRoles.has(roleId));
  if (!isAllowed) {
    await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    return;
  }

  if (interaction.commandName === 'rank') {
    const username = interaction.options.getString('username');
    const rankId = interaction.options.getInteger('rank');

    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = await noblox.getIdFromUsername(username);
      await noblox.setRank(process.env.GROUP_ID, userId, rankId);
      await interaction.editReply(`✅ Successfully set rank of **${username}** to ${rankId}.`);
    } catch (err) {
      console.error(err);
      await interaction.editReply('❌ Failed to assign rank. Make sure Roblox usernames are correct.');
    }
  }
});

// Start Discord bot
client.login(process.env.DISCORD_TOKEN);

// Suppress deprecation warnings
noblox.setOptions({ show_deprecation_warnings: false });
