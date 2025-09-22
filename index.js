// index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import express from 'express';
import noblox from 'noblox.js';

// ---------- EXPRESS SERVER TO KEEP BOT ONLINE ----------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is online!'));
app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// ---------- DISCORD BOT ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Roblox login
async function loginRoblox() {
    try {
        await noblox.setCookie(process.env.ROBLOX_COOKIE);
        console.log('✅ Logged into Roblox');
    } catch (err) {
        console.error('❌ Failed to log in to Roblox:', err);
    }
}

// Register slash commands manually
const commands = [
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Assign a rank to a Roblox user')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Roblox username')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('rank')
                .setDescription('Roblox rank number')
                .setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Slash commands registered.');
    } catch (err) {
        console.error('❌ Error registering commands:', err);
    }
}

client.on('clientReady', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    await loginRoblox();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'rank') {
        const username = interaction.options.getString('username');
        const rank = interaction.options.getInteger('rank');

        try {
            const userId = await noblox.getIdFromUsername(username);
            await noblox.setRank(process.env.GROUP_ID, userId, rank);
            await interaction.reply(`✅ Successfully set **${username}** to rank **${rank}**`);
        } catch (err) {
            console.error(err);
            await interaction.reply(`❌ Failed to assign rank. Make sure Roblox usernames are correct.`);
        }
    }
});

// Start bot
registerCommands();
client.login(process.env.DISCORD_TOKEN);
