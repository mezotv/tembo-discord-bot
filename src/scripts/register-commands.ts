import {
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	InteractionContextType,
	type RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";

const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
	{
		name: "task",
		description: "Manage Tembo tasks",
		integration_types: [
			ApplicationIntegrationType.GuildInstall,
			ApplicationIntegrationType.UserInstall,
		],
		contexts: [
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		],
		options: [
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "create",
				description: "Create a new Tembo task",
				options: [
					{
						type: ApplicationCommandOptionType.String,
						name: "prompt",
						description: "Description of the task to be performed",
						required: true,
						min_length: 1,
						max_length: 2000,
					},
					{
						type: ApplicationCommandOptionType.String,
						name: "agent",
						description:
							"The agent to use for this task (e.g., claudeCode:claude-4-5-sonnet)",
						required: false,
						autocomplete: true,
					},
					{
						type: ApplicationCommandOptionType.String,
						name: "repositories",
						description: "Comma-separated list of repository URLs",
						required: false,
						autocomplete: true,
					},
					{
						type: ApplicationCommandOptionType.String,
						name: "branch",
						description: "Specific git branch to target for this task",
						required: false,
					},
					{
						type: ApplicationCommandOptionType.Boolean,
						name: "ephemeral",
						description: "Whether to send the response as an ephemeral message",
						required: false,
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "list",
				description: "List Tembo tasks with pagination",
				options: [
					{
						type: ApplicationCommandOptionType.Integer,
						name: "page",
						description: "Page number to retrieve (default: 1)",
						required: false,
						min_value: 1,
					},
					{
						type: ApplicationCommandOptionType.Integer,
						name: "limit",
						description: "Number of tasks per page (default: 10, max: 100)",
						required: false,
						min_value: 1,
						max_value: 100,
					},
					{
						type: ApplicationCommandOptionType.Boolean,
						name: "ephemeral",
						description: "Whether to send the response as an ephemeral message",
						required: false,
					},
				],
			},
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "search",
				description: "Search Tembo tasks by query",
				options: [
					{
						type: ApplicationCommandOptionType.String,
						name: "query",
						description: "Search query",
						required: true,
						min_length: 1,
					},
					{
						type: ApplicationCommandOptionType.Integer,
						name: "page",
						description: "Page number to retrieve (default: 1)",
						required: false,
						min_value: 1,
					},
					{
						type: ApplicationCommandOptionType.Integer,
						name: "limit",
						description: "Number of results per page (default: 10, max: 100)",
						required: false,
						min_value: 1,
						max_value: 100,
					},
					{
						type: ApplicationCommandOptionType.Boolean,
						name: "ephemeral",
						description: "Whether to send the response as an ephemeral message",
						required: false,
					},
				],
			},
		],
	},
	{
		name: "repositories",
		description: "Manage Tembo repositories",
		integration_types: [
			ApplicationIntegrationType.GuildInstall,
			ApplicationIntegrationType.UserInstall,
		],
		contexts: [
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		],
		options: [
			{
				type: ApplicationCommandOptionType.Subcommand,
				name: "list",
				description: "List available repositories from your Tembo account",
				options: [
					{
						type: ApplicationCommandOptionType.Boolean,
						name: "ephemeral",
						description: "Whether to send the response as an ephemeral message",
						required: false,
					},
				],
			},
		],
	},
	{
		name: "whoami",
		description: "Get your current Tembo user information",
		integration_types: [
			ApplicationIntegrationType.GuildInstall,
			ApplicationIntegrationType.UserInstall,
		],
		contexts: [
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		],
		options: [
			{
				type: ApplicationCommandOptionType.Boolean,
				name: "ephemeral",
				description: "Whether to send the response as an ephemeral message",
				required: false,
			},
		],
	},
	{
		name: "setup",
		description: "Register or update your Tembo API key",
		integration_types: [
			ApplicationIntegrationType.GuildInstall,
			ApplicationIntegrationType.UserInstall,
		],
		contexts: [
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		],
		options: [
			{
				type: ApplicationCommandOptionType.String,
				name: "key",
				description: "Your Tembo API key",
				required: true,
				min_length: 10,
			},
		],
	},
	{
		name: "unregister",
		description: "Remove your registered Tembo API key from the bot",
		integration_types: [
			ApplicationIntegrationType.GuildInstall,
			ApplicationIntegrationType.UserInstall,
		],
		contexts: [
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		],
		options: [
			{
				type: ApplicationCommandOptionType.Boolean,
				name: "confirm",
				description: "Confirm that you want to remove your API key",
				required: false,
			},
		],
	},
	{
		name: "status",
		description: "Check your Tembo API key registration status",
		integration_types: [
			ApplicationIntegrationType.GuildInstall,
			ApplicationIntegrationType.UserInstall,
		],
		contexts: [
			InteractionContextType.Guild,
			InteractionContextType.BotDM,
			InteractionContextType.PrivateChannel,
		],
	},
];

async function registerCommands() {
	const applicationId = process.env.DISCORD_APPLICATION_ID;
	const botToken = process.env.DISCORD_BOT_TOKEN;

	if (!applicationId || !botToken) {
		console.error("Error: Missing required environment variables.");
		console.error("Please set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN");
		process.exit(1);
	}

	const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

	try {
		console.log("Registering slash commands...");
		console.log(`URL: ${url}`);
		console.log(`Commands to register: ${commands.length}`);

		const response = await fetch(url, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bot ${botToken}`,
			},
			body: JSON.stringify(commands),
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(
				`Failed to register commands: ${response.status} ${response.statusText}\n${errorData}`,
			);
		}

		const data = (await response.json()) as Array<{
			name: string;
			description: string;
			options?: {
				type: number;
				name: string;
				description: string;
			}[];
		}>;
		console.log(`✅ Successfully registered ${data.length} slash command(s)!`);
		console.log("Commands:");
		for (const cmd of data) {
			console.log(`  - /${cmd.name}: ${cmd.description}`);
			if (cmd.options) {
				for (const opt of cmd.options) {
					if (opt.type === 1 || opt.type === 2) {
						// Subcommand or SubcommandGroup
						console.log(`    └─ ${opt.name}: ${opt.description}`);
					}
				}
			}
		}
	} catch (error) {
		console.error("❌ Error registering commands:", error);
		process.exit(1);
	}
}

registerCommands();
