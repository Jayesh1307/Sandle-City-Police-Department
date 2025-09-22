import 'dotenv/config';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import fs from 'fs';
import path from 'path';
import noblox from 'noblox.js';
import express from 'express';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load slash commands
const commandsPath = path.join('./commands'); // your commands folder
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(filePath);
  client.commands.set(command.data.name, command);
}

// Express server to keep bot online
const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000, () => console.log('Express server running'));

// Discord ready event
client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Roblox login
async function loginRoblox() {
  try {
    await noblox.cookieLogin(process.env.ROBLOX_COOKIE);
    console.log('✅ Logged into Roblox');
  } catch (err) {
    console.error('❌ Failed to log in to Roblox:', err);
  }
}
await loginRoblox();

// Interaction handler
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'There was an error executing that command.', ephemeral: true });
    }
  }

  // Handle rank dropdown interaction
  if (interaction.isStringSelectMenu()) {
    const command = client.commands.get('rank'); // your rank command
    if (command && command.executeSelectMenu) {
      await command.executeSelectMenu(interaction);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

export default client;
