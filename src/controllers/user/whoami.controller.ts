import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
} from "discord-api-types/v10";
import { InteractionResponseType } from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import { logger } from "../../utils/logger";
import type { Env } from "../../types";
import { updateInteractionResponse } from "../../utils/discord";

export class WhoamiController extends BaseController {
	async handle(
		interaction: APIChatInputApplicationCommandInteraction,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const userId =
			interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";
		const startTime = Date.now();
		const ephemeral = true; // Always ephemeral for privacy
		const applicationId = env?.DISCORD_APPLICATION_ID;
		const interactionToken = interaction.token;

		logger.info("Processing whoami command", { userId, ephemeral });

		if (ctx && applicationId) {
			ctx.waitUntil(
				this.processWhoami(
					userId,
					startTime,
					ephemeral,
					applicationId,
					interactionToken,
				),
			);
			// Return initial loading response
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: "👤 Loading your account info...",
					flags: ephemeral ? 64 : undefined,
				},
			};
		}

		const userInfo = await this.getTemboService().getCurrentUser();

		const duration = Date.now() - startTime;
		logger.command("whoami", userId, true, duration);

		const embed = {
			title: "👤 Your Tembo Account Info",
			fields: [
				{
					name: "User ID",
					value: userInfo.userId || "N/A",
					inline: true,
				},
				{
					name: "Organization ID",
					value: userInfo.orgId || "N/A",
					inline: true,
				},
			],
			color: 0x5865f2,
			timestamp: new Date().toISOString(),
		};

		if (userInfo.email) {
			embed.fields.push({
				name: "Email",
				value: userInfo.email,
				inline: false,
			});
		}

		return this.createEmbedResponse([embed], ephemeral);
	}

	private async processWhoami(
		userId: string,
		startTime: number,
		ephemeral: boolean,
		applicationId: string,
		interactionToken: string,
	): Promise<void> {
		try {
			const userInfo = await this.getTemboService().getCurrentUser();

			const duration = Date.now() - startTime;
			logger.command("whoami", userId, true, duration);

			const embed = {
				title: "👤 Your Tembo Account Info",
				fields: [
					{
						name: "User ID",
						value: userInfo.userId || "N/A",
						inline: true,
					},
					{
						name: "Organization ID",
						value: userInfo.orgId || "N/A",
						inline: true,
					},
				],
				color: 0x5865f2,
				timestamp: new Date().toISOString(),
			};

			if (userInfo.email) {
				embed.fields.push({
					name: "Email",
					value: userInfo.email,
					inline: false,
				});
			}

			await updateInteractionResponse(applicationId, interactionToken, {
				embeds: [embed],
				flags: ephemeral ? 64 : undefined,
			});
		} catch (error) {
			logger.error("Failed to process whoami in background", error);
			await updateInteractionResponse(applicationId, interactionToken, {
				content: "❌ Failed to retrieve user info.",
				flags: 64,
			});
		}
	}
}
