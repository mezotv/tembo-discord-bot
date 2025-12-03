import { Hono } from "hono";
import {
	InteractionType,
	InteractionResponseType,
	type APIInteraction,
	type APIInteractionResponse,
	type APIChatInputApplicationCommandInteraction,
	type APIApplicationCommandAutocompleteInteraction,
	type APIMessageComponentInteraction,
} from "discord-api-types/v10";
import { verifyDiscordRequest } from "./utils/verify";
import { createTemboService } from "./services/tembo.service";
import {
	TaskController,
	RepositoriesController,
	WhoamiController,
	SetupController,
	UnregisterController,
	StatusController,
} from "./controllers";
import { AuthService } from "./services/auth.service";
import { DatabaseService } from "./services/database.service";
import { EncryptionService } from "./services/encryption.service";
import { triggerOnboarding } from "./utils/discord";
import type { Env } from "./types";
import { logger } from "./utils/logger";
import { asyncHandler } from "./utils/async-handler";

// Commands that don't require authentication
const UNAUTHENTICATED_COMMANDS = ["setup", "unregister", "status"];

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
	return c.text("Tembo Discord Bot is running! 🤖");
});

app.post("/interactions", async (c) => {
	const env = c.env;
	const ctx = c.executionCtx;

	const isValid = await verifyDiscordRequest(c.req.raw, env.DISCORD_PUBLIC_KEY);
	if (!isValid) {
		logger.warn("Invalid request signature");
		return c.text("Invalid request signature", 401);
	}

	const interaction = await c.req.json<APIInteraction>();

	if (interaction.type === InteractionType.Ping) {
		const response: APIInteractionResponse = {
			type: InteractionResponseType.Pong,
		};
		return c.json(response);
	}

	if (interaction.type === InteractionType.ApplicationCommand) {
		const commandInteraction =
			interaction as APIChatInputApplicationCommandInteraction;
		const commandName = commandInteraction.data.name;
		const userId =
			commandInteraction.member?.user?.id ??
			commandInteraction.user?.id ??
			"unknown";

		logger.info("Received command", {
			command: commandName,
			userId,
		});

		// Initialize auth services
		const authService = new AuthService(
			new DatabaseService(env.tembo_bot_db),
			new EncryptionService(env.ENCRYPTION_MASTER_KEY),
		);

		let temboService = null;

		// Check if command requires authentication
		if (!UNAUTHENTICATED_COMMANDS.includes(commandName)) {
			// Authenticate user
			const authResult = await authService.authenticateUser(userId);

			if (!authResult.success) {
				if (authResult.requiresOnboarding) {
					// Trigger onboarding DM (async, don't wait)
					ctx.waitUntil(triggerOnboarding(userId, env.DISCORD_BOT_TOKEN));

					// Send ephemeral response
					return c.json({
						type: InteractionResponseType.ChannelMessageWithSource,
						data: {
							content:
								"🔐 **Setup Required!**\n\n" +
								"I've sent you a DM with instructions to register your Tembo API key.\n\n" +
								"Please check your direct messages and run `/setup key:YOUR_API_KEY`\n\n" +
								"**Don't see the DM?** You may have DMs disabled. Run `/setup key:YOUR_API_KEY` here instead.",
							flags: 64, // Ephemeral
						},
					});
				}

				// Authentication failed for other reasons
				return c.json({
					type: InteractionResponseType.ChannelMessageWithSource,
					data: {
						content: `❌ ${authResult.error || "Authentication failed. Please use `/setup` to register your API key."}`,
						flags: 64,
					},
				});
			}

			// User is authenticated - use their TemboService
			temboService = authResult.temboService!;
		}

		// Create controllers (auth controllers get authService, others get temboService)
		const controllers = {
			task: new TaskController(temboService),
			repositories: new RepositoriesController(temboService),
			whoami: new WhoamiController(temboService),
			setup: new SetupController(authService),
			unregister: new UnregisterController(authService),
			status: new StatusController(authService),
		};

		const controller = controllers[commandName as keyof typeof controllers];

		if (!controller) {
			logger.warn("Unknown command", { command: commandName, userId });
			const response: APIInteractionResponse = {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: `❌ Unknown command: ${commandName}. Please try again or contact support.`,
					flags: 64,
				},
			};
			return c.json(response);
		}

		const response = await asyncHandler(
			() => controller.handle(commandInteraction, ctx, env),
			commandName,
			userId,
		);
		return c.json(response);
	}

	if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
		const autocompleteInteraction =
			interaction as APIApplicationCommandAutocompleteInteraction;
		const commandName = autocompleteInteraction.data.name;
		const userId =
			autocompleteInteraction.member?.user?.id ??
			autocompleteInteraction.user?.id ??
			"unknown";

		// Autocomplete only for authenticated commands (task, repositories)
		// Auth services for user lookup
		const authService = new AuthService(
			new DatabaseService(env.tembo_bot_db),
			new EncryptionService(env.ENCRYPTION_MASTER_KEY),
		);

		// Authenticate user for autocomplete
		const authResult = await authService.authenticateUser(userId);

		if (!authResult.success) {
			// Return empty choices if not authenticated
			const response: APIInteractionResponse = {
				type: InteractionResponseType.ApplicationCommandAutocompleteResult,
				data: {
					choices: [],
				},
			};
			return c.json(response);
		}

		const temboService = authResult.temboService!;

		const controllers = {
			task: new TaskController(temboService),
			repositories: new RepositoriesController(temboService),
			whoami: new WhoamiController(temboService),
		};

		const controller = controllers[commandName as keyof typeof controllers];

		if (controller) {
			try {
				const response = await controller.handleAutocomplete(autocompleteInteraction);
				return c.json(response);
			} catch (error) {
				logger.error("Error handling autocomplete", error, { command: commandName });
			}
		}

		const response: APIInteractionResponse = {
			type: InteractionResponseType.ApplicationCommandAutocompleteResult,
			data: {
				choices: [],
			},
		};
		return c.json(response);
	}

	if (interaction.type === InteractionType.MessageComponent) {
		const componentInteraction = interaction as APIMessageComponentInteraction;
		const customId = componentInteraction.data.custom_id;
		const userId =
			componentInteraction.member?.user?.id ??
			componentInteraction.user?.id ??
			"unknown";

		// Authenticate user for component interactions
		const authService = new AuthService(
			new DatabaseService(env.tembo_bot_db),
			new EncryptionService(env.ENCRYPTION_MASTER_KEY),
		);

		const authResult = await authService.authenticateUser(userId);

		if (!authResult.success) {
			// User not authenticated
			return c.json({
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: "❌ You must register your API key to use this feature. Use `/setup key:YOUR_API_KEY`",
					flags: 64,
				},
			});
		}

		const temboService = authResult.temboService!;

		const controllers = {
			task: new TaskController(temboService),
			repositories: new RepositoriesController(temboService),
			whoami: new WhoamiController(temboService),
		};

		// Route based on custom_id prefix
		let controller;
		if (customId.startsWith("task_")) {
			controller = controllers.task;
		}

		if (controller) {
			try {
				// Pass ctx and env to handleComponent for deferred responses
				const response = await controller.handleComponent(componentInteraction, ctx, env);
				return c.json(response);
			} catch (error) {
				logger.error("Error handling component interaction", error, { customId });
			}
		}

		const response: APIInteractionResponse = {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: "❌ Unknown interaction or handler not found.",
				flags: 64,
			},
		};
		return c.json(response);
	}

	logger.warn("Unsupported interaction type", {
		type: interaction.type,
	});

	const response: APIInteractionResponse = {
		type: InteractionResponseType.ChannelMessageWithSource,
		data: {
			content: "❌ Unsupported interaction type.",
			flags: 64,
		},
	};
	return c.json(response, 400);
});

export default app;
