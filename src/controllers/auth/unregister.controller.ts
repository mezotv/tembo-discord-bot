import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
} from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import { AuthService } from "../../services/auth.service";
import type { Env } from "../../types";
import { logger } from "../../utils/logger";

export class UnregisterController extends BaseController {
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

		const confirm = optionsMap.confirm as boolean;

		logger.info("Processing /unregister command", { userId, confirm });

		// Check if user is registered
		const isRegistered = await this.authService.isUserRegistered(userId);

		if (!isRegistered) {
			return this.createErrorResponse(
				"You don't have a registered API key.\n\nUse `/setup key:YOUR_API_KEY` to register.",
			);
		}

		// Require confirmation
		if (!confirm) {
			return {
				type: 4, // InteractionResponseType.ChannelMessageWithSource
				data: {
					content:
						"⚠️ **Are you sure you want to remove your API key?**\n\n" +
						"This will:\n" +
						"• Delete your encrypted API key from our database\n" +
						"• Prevent you from using bot commands until you register again\n" +
						"• Require you to run `/setup` to use the bot again\n\n" +
						"**To confirm, run:** `/unregister confirm:true`",
					flags: 64, // Ephemeral
				},
			};
		}

		// User confirmed - delete their API key
		try {
			await this.authService.unregisterUser(userId);

			logger.info("User unregistered successfully", { userId });

			return this.createSuccessResponse(
				"✅ **Your API key has been removed successfully.**\n\n" +
					"Your encrypted API key has been deleted from our database. You'll need to register again to use the bot.\n\n" +
					"**To register again:** `/setup key:YOUR_API_KEY`",
				true, // Ephemeral
			);
		} catch (error) {
			logger.error("Failed to unregister user", error, { userId });
			return this.createErrorResponse(
				"Failed to remove your API key. Please try again later or contact support.",
			);
		}
	}
}
