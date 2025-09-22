import Discord from 'discord.js';
import * as noblox from 'noblox.js';
import dotenv from 'dotenv';

dotenv.config();

// Discord client
const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent
    ]
});

// Roblox login
async function loginRoblox() {
    try {
        await noblox.setCookie(process.env.ROBLOX_COOKIE);
        console.log('✅ Logged in to Roblox!');
    } catch (err) {
        console.error('❌ Failed to log in to Roblox:', err);
    }
}

loginRoblox();

// Command registration
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Register slash command /rank
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.commands.set([
        {
            name: 'rank',
            description: 'Promote or demote a user within your Roblox group rank limits',
            options: [
                {
                    name: 'user',
                    description: 'The Discord user to promote/demote',
                    type: Discord.ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: 'rank',
                    description: 'The Roblox rank to assign',
                    type: Discord.ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        }
    ]);
});

// Handle /rank command
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'rank') {
        const targetUser = interaction.options.getUser('user');
        const rankName = interaction.options.getString('rank');

        try {
            // Get Roblox group info
            const groupId = parseInt(process.env.GROUP_ID);
            const userId = await noblox.getIdFromUsername(targetUser.username);

            // Get command user's Roblox rank
            const commandUserId = await noblox.getIdFromUsername(interaction.user.username);
            const commandUserRank = await noblox.getRankInGroup(groupId, commandUserId);

            // Get target rank ID
            const groupRoles = await noblox.getRoles(groupId);
            const targetRole = groupRoles.find(r => r.name.toLowerCase() === rankName.toLowerCase());
            if (!targetRole) {
                return interaction.reply({ content: `❌ Rank "${rankName}" not found in the Roblox group.`, ephemeral: true });
            }

            // Prevent promoting above your own rank
            if (targetRole.rank >= commandUserRank) {
                return interaction.reply({ content: `❌ You cannot promote/demote to a rank equal or higher than your own.`, ephemeral: true });
            }

            // Promote/demote
            await noblox.setRank(groupId, userId, targetRole.rank);

            // Reply in Discord
            await interaction.reply({ content: `✅ ${targetUser.tag} has been set to rank **${targetRole.name}**.` });

            // Log in the logs channel
            const logChannel = await client.channels.fetch(process.env.LOGS_CHANNEL_ID);
            logChannel.send(`📝 ${interaction.user.tag} changed ${targetUser.tag}'s Roblox rank to **${targetRole.name}**.`);
        } catch (err) {
            console.error(err);
            interaction.reply({ content: '❌ An error occurred. Check console for details.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
