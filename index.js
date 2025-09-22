// index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, Routes, REST } from 'discord.js';
import noblox from 'noblox.js';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 10000;

// Keep the bot online via Express
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID;
const GROUP_ID = parseInt(process.env.GROUP_ID);

// Login to Roblox
async function loginRoblox() {
    try {
        await noblox.cookieLogin(process.env.ROBLOX_COOKIE);
        console.log('✅ Logged into Roblox');
    } catch (err) {
        console.error('❌ Failed to log in to Roblox:', err);
    }
}

// Register slash command /rank
async function registerCommands() {
    const commands = [{
        name: 'rank',
        description: 'Promote or demote a user in the Roblox group',
        options: [
            {
                name: 'username',
                description: 'Roblox username of the user',
                type: 3, // STRING
                required: true
            },
            {
                name: 'rank',
                description: 'Rank to assign',
                type: 3, // STRING
                required: true
            }
        ]
    }];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log('✅ Slash commands registered.');
    } catch (err) {
        console.error(err);
    }
}

// Handle /rank interaction
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'rank') {
        const username = interaction.options.getString('username');
        const newRank = interaction.options.getString('rank');

        try {
            const userId = await noblox.getIdFromUsername(username);
            const currentRank = await noblox.getRankInGroup(GROUP_ID, userId);
            const botRank = await noblox.getRankInGroup(GROUP_ID, (await noblox.getCurrentUser()).UserId);

            // Check rank restrictions
            if (currentRank >= botRank || parseInt(newRank) >= botRank) {
                return interaction.reply({ content: '❌ You cannot promote/demote above the bot\'s rank.', ephemeral: true });
            }

            await noblox.setRank(GROUP_ID, userId, parseInt(newRank));
            interaction.reply({ content: `✅ ${username} has been assigned rank ${newRank}` });

            // Log action
            const logsChannel = await client.channels.fetch(LOGS_CHANNEL_ID);
            logsChannel.send(`**${interaction.user.tag}** set rank of **${username}** to **${newRank}**`);
        } catch (err) {
            console.error(err);
            interaction.reply({ content: '❌ Failed to assign rank. Make sure the Roblox username is correct.', ephemeral: true });
        }
    }
});

// Bot ready
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await loginRoblox();
    await registerCommands();
});

// Login Discord
client.login(TOKEN);
