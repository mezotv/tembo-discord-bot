import { Hono } from "hono";
import {
	InteractionType,
	InteractionResponseType,
	type APIInteraction,
	type APIInteractionResponse,
	type APIChatInputApplicationCommandInteraction,
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
			() => controller.handle(commandInteraction, ctx),
			commandName,
			userId,
		);
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
