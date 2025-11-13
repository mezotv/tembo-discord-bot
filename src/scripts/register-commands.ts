// Script to register Discord slash commands

import { ApplicationCommand, ApplicationCommandOptionType } from '../types/discord';

// Define slash commands
const commands: ApplicationCommand[] = [
  {
    name: 'create-task',
    description: 'Create a new Tembo task',
    options: [
      {
        type: ApplicationCommandOptionType.STRING,
        name: 'prompt',
        description: 'Description of the task to be performed',
        required: true,
        min_length: 1,
        max_length: 2000,
      },
      {
        type: ApplicationCommandOptionType.STRING,
        name: 'agent',
        description: 'The agent to use for this task (e.g., claudeCode:claude-4-5-sonnet)',
        required: false,
      },
      {
        type: ApplicationCommandOptionType.STRING,
        name: 'repositories',
        description: 'Comma-separated list of repository URLs',
        required: false,
      },
      {
        type: ApplicationCommandOptionType.STRING,
        name: 'branch',
        description: 'Specific git branch to target for this task',
        required: false,
      },
    ],
  },
  {
    name: 'list-tasks',
    description: 'List Tembo tasks with pagination',
    options: [
      {
        type: ApplicationCommandOptionType.INTEGER,
        name: 'page',
        description: 'Page number to retrieve (default: 1)',
        required: false,
        min_value: 1,
      },
      {
        type: ApplicationCommandOptionType.INTEGER,
        name: 'limit',
        description: 'Number of tasks per page (default: 10, max: 100)',
        required: false,
        min_value: 1,
        max_value: 100,
      },
    ],
  },
  {
    name: 'search-tasks',
    description: 'Search Tembo tasks by query',
    options: [
      {
        type: ApplicationCommandOptionType.STRING,
        name: 'query',
        description: 'Search query',
        required: true,
        min_length: 1,
      },
      {
        type: ApplicationCommandOptionType.INTEGER,
        name: 'page',
        description: 'Page number to retrieve (default: 1)',
        required: false,
        min_value: 1,
      },
      {
        type: ApplicationCommandOptionType.INTEGER,
        name: 'limit',
        description: 'Number of results per page (default: 10, max: 100)',
        required: false,
        min_value: 1,
        max_value: 100,
      },
    ],
  },
  {
    name: 'list-repositories',
    description: 'List available repositories from your Tembo account',
  },
  {
    name: 'whoami',
    description: 'Get your current Tembo user information',
  },
];

// Main function to register commands
async function registerCommands() {
  // Get environment variables
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!applicationId || !botToken) {
    console.error('Error: Missing required environment variables.');
    console.error('Please set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN');
    process.exit(1);
  }

  const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

  try {
    console.log('Registering slash commands...');
    console.log(`URL: ${url}`);
    console.log(`Commands to register: ${commands.length}`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to register commands: ${response.status} ${response.statusText}\n${errorData}`);
    }

    const data = await response.json();
    console.log(`✅ Successfully registered ${data.length} slash command(s)!`);
    console.log('Commands:');
    data.forEach((cmd: any) => {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    });
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    process.exit(1);
  }
}

// Run the registration
registerCommands();

