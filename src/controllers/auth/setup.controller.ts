import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
	APIEmbed,
} from "discord-api-types/v10";
import { InteractionResponseType } from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import { AuthService } from "../../services/auth.service";
import type { Env } from "../../types";
import { logger } from "../../utils/logger";
import { updateInteractionResponse } from "../../utils/discord";

export class SetupController extends BaseController {
	constructor(private readonly authService: AuthService) {
		// Auth controllers don't need TemboService
		super(null as any);
	}

	async handle(
		interaction: APIChatInputApplicationCommandInteraction,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const userId =
			interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";
		const optionsMap = this.getOptionsMap(interaction.data.options);

		const apiKey = optionsMap.key as string;

		// Validate input
		if (!apiKey || apiKey.trim().length === 0) {
			return this.createErrorResponse(
				"API key is required.\n\n**Usage:** `/setup key:YOUR_API_KEY`\n\n**Get your API key:** Visit the Tembo dashboard → Settings → API Keys",
			);
		}

		logger.info("Processing /setup command", { userId });

		const applicationId = env?.DISCORD_APPLICATION_ID;
		const interactionToken = interaction.token;

		// Use deferred response for long-running operations (API validation can take time)
		if (ctx && applicationId) {
			ctx.waitUntil(
				this.processSetup(
					userId,
					apiKey.trim(),
					applicationId,
					interactionToken,
				),
			);
			// Return initial loading response (ephemeral for security)
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: "🔐 Validating and registering your API key...",
					flags: 64, // Ephemeral
				},
			};
		}

		// Fallback: process synchronously if no context (shouldn't happen in production)
		const result = await this.authService.registerApiKey(userId, apiKey.trim());

		if (!result.success) {
			logger.warn("API key registration failed", {
				userId,
				error: result.error,
			});

			return this.createErrorResponse(
				`${result.error}\n\n**Tip:** Make sure you copied the entire API key from your Tembo dashboard.`,
			);
		}

		return this.createSuccessResponse(
			`✅ API key registered successfully! User ID: ${result.userInfo?.userId}`,
			true,
		);
	}

	private async processSetup(
		userId: string,
		apiKey: string,
		applicationId: string,
		interactionToken: string,
	): Promise<void> {
		try {
			// Validate and register the API key
			const result = await this.authService.registerApiKey(userId, apiKey);

			if (!result.success) {
				logger.warn("API key registration failed", {
					userId,
					error: result.error,
				});

				await updateInteractionResponse(applicationId, interactionToken, {
					content: `❌ ${result.error}\n\n**Tip:** Make sure you copied the entire API key from your Tembo dashboard.`,
					flags: 64, // Ephemeral
				});
				return;
			}

			// Success! Show user their account info
			const userInfo = result.userInfo!;

			const embed: APIEmbed = {
				title: "✅ API Key Registered Successfully!",
				description:
					"Your Tembo API key has been encrypted and stored securely. You can now use all Tembo bot commands.",
				color: 0x00ff00, // Green
				fields: [
					{
						name: "👤 Tembo Account",
						value: `**User ID:** \`${userInfo.userId}\`\n**Org ID:** \`${userInfo.orgId}\`${userInfo.email ? `\n**Email:** ${userInfo.email}` : ""}`,
						inline: false,
					},
					{
						name: "🚀 Available Commands",
						value:
							"• `/task create` - Create new tasks\n• `/task list` - View your tasks\n• `/task search` - Search tasks\n• `/repositories list` - List repositories\n• `/whoami` - Check account info\n• `/status` - View registration status",
						inline: false,
					},
					{
						name: "🔐 Security",
						value:
							"Your API key is encrypted using AES-256-GCM and stored securely. Only you can access your Tembo account through this bot.",
						inline: false,
					},
					{
						name: "📝 Manage Your Key",
						value:
							"• `/setup` - Update your API key\n• `/unregister` - Remove your API key\n• `/status` - Check registration status",
						inline: false,
					},
				],
				footer: {
					text: "Never share your API key with anyone",
				},
				timestamp: new Date().toISOString(),
			};

			await updateInteractionResponse(applicationId, interactionToken, {
				embeds: [embed],
				flags: 64, // Ephemeral
			});

			logger.info("User registered successfully", { userId });
		} catch (error) {
			logger.error("Error processing setup", error, { userId });
			await updateInteractionResponse(applicationId, interactionToken, {
				content: "❌ An unexpected error occurred while registering your API key. Please try again.",
				flags: 64, // Ephemeral
			});
		}
	}
}
