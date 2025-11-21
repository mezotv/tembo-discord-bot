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
} from "./controllers";
import type { Env } from "./types";
import { logger } from "./utils/logger";
import { asyncHandler } from "./utils/async-handler";

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

		const temboService = createTemboService(env.TEMBO_API_KEY);

		const controllers = {
			task: new TaskController(temboService),
			repositories: new RepositoriesController(temboService),
			whoami: new WhoamiController(temboService),
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

		const temboService = createTemboService(env.TEMBO_API_KEY);

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

		const temboService = createTemboService(env.TEMBO_API_KEY);

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
