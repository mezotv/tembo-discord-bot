import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
} from "discord-api-types/v10";
import { InteractionResponseType } from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import { logger } from "../../utils/logger";
import { ValidationError } from "../../utils/errors";
import type { Env } from "../../types";
import { updateInteractionResponse } from "../../utils/discord";

export class RepositoriesController extends BaseController {
	async handle(
		interaction: APIChatInputApplicationCommandInteraction,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const userId =
			interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";
		const startTime = Date.now();

		const subcommand = this.getSubcommandName(interaction.data.options);

		if (!subcommand) {
			throw new ValidationError("No subcommand specified. Use: list");
		}

		switch (subcommand) {
			case "list":
				return this.handleList(interaction, userId, startTime, ctx, env);
			default:
				throw new ValidationError(
					`Unknown subcommand: ${subcommand}. Use: list`,
				);
		}
	}

	private async handleList(
		interaction: APIChatInputApplicationCommandInteraction,
		userId: string,
		startTime: number,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const ephemeral = this.getEphemeralFlag(interaction.data.options);
		const applicationId = env?.DISCORD_APPLICATION_ID;
		const interactionToken = interaction.token;

		logger.info("Processing repositories list command", { userId, ephemeral });

		// If we have context and env, use deferred response pattern
		if (ctx && applicationId) {
			ctx.waitUntil(
				this.processListRepositories(
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
					content: "📦 Loading your repositories...",
					flags: ephemeral ? 64 : undefined,
				},
			};
		}

		// Fallback to synchronous execution (might timeout)
		const result = await this.temboService.listRepositories();

		const duration = Date.now() - startTime;
		logger.command("repositories list", userId, true, duration);

		if (!result.codeRepositories || result.codeRepositories.length === 0) {
			return this.createSuccessResponse(
				"📦 No repositories found.\n\nConnect your repositories in the Tembo dashboard.",
				ephemeral,
			);
		}

		const embed = {
			title: "📦 Your Connected Repositories",
			description: `${result.codeRepositories.length} repository(ies) connected`,
			fields: result.codeRepositories.slice(0, 10).map((repo) => ({
				name: repo.name || "Unnamed Repository",
				value: [
					`**URL:** ${repo.url}`,
					repo.branch ? `**Branch:** ${repo.branch}` : "",
					repo.integration?.type
						? `**Provider:** ${repo.integration.type}`
						: "",
					repo.description
						? `**Description:** ${repo.description.substring(0, 100)}`
						: "",
				]
					.filter(Boolean)
					.join("\n"),
				inline: false,
			})),
			color: 0x5865f2,
			footer: {
				text: `${result.codeRepositories.length} total repositories`,
			},
		};

		return this.createEmbedResponse([embed], ephemeral);
	}

	private async processListRepositories(
		userId: string,
		startTime: number,
		ephemeral: boolean,
		applicationId: string,
		interactionToken: string,
	): Promise<void> {
		try {
			const result = await this.temboService.listRepositories();
			const duration = Date.now() - startTime;
			logger.command("repositories list", userId, true, duration);

			let body;
			if (!result.codeRepositories || result.codeRepositories.length === 0) {
				body = {
					content:
						"📦 No repositories found.\n\nConnect your repositories in the Tembo dashboard.",
					flags: ephemeral ? 64 : undefined,
				};
			} else {
				const embed = {
					title: "📦 Your Connected Repositories",
					description: `${result.codeRepositories.length} repository(ies) connected`,
					fields: result.codeRepositories.slice(0, 10).map((repo) => ({
						name: repo.name || "Unnamed Repository",
						value: [
							`**URL:** ${repo.url}`,
							repo.branch ? `**Branch:** ${repo.branch}` : "",
							repo.integration?.type
								? `**Provider:** ${repo.integration.type}`
								: "",
							repo.description
								? `**Description:** ${repo.description.substring(0, 100)}`
								: "",
						]
							.filter(Boolean)
							.join("\n"),
						inline: false,
					})),
					color: 0x5865f2,
					footer: {
						text: `${result.codeRepositories.length} total repositories`,
					},
				};
				body = {
					embeds: [embed],
					flags: ephemeral ? 64 : undefined,
				};
			}

			await updateInteractionResponse(applicationId, interactionToken, body);
		} catch (error) {
			logger.error("Failed to process repositories list in background", error);
			const message = "❌ Failed to retrieve repositories.";
			await updateInteractionResponse(applicationId, interactionToken, {
				content: message,
				flags: 64,
			});
		}
	}
}
