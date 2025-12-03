import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
	APIEmbed,
} from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import { AuthService } from "../../services/auth.service";
import type { Env } from "../../types";
import { logger } from "../../utils/logger";

export class StatusController extends BaseController {
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

		logger.info("Processing /status command", { userId });

		const status = await this.authService.getUserStatus(userId);

		if (!status.registered) {
			// User is not registered
			const embed: APIEmbed = {
				title: "❌ Not Registered",
				description:
					"You don't have a Tembo API key registered with this bot.",
				color: 0xff0000, // Red
				fields: [
					{
						name: "📝 How to Register",
						value:
							"Use the `/setup` command to register your Tembo API key:\n\n" +
							"**Command:** `/setup key:YOUR_API_KEY`\n\n" +
							"**Get your API key:**\n" +
							"1. Visit [Tembo Dashboard](https://tembo.ai/dashboard)\n" +
							"2. Go to Settings → API Keys\n" +
							"3. Generate or copy your API key\n" +
							"4. Run `/setup key:YOUR_API_KEY` in this channel or DM",
						inline: false,
					},
					{
						name: "🔐 Security",
						value:
							"Your API key will be encrypted using AES-256-GCM and stored securely. Only you can access your Tembo account.",
						inline: false,
					},
				],
				timestamp: new Date().toISOString(),
			};

			return this.createEmbedResponse([embed], true); // Ephemeral
		}

		// User is registered - show their info
		const validationStatusEmoji =
			status.validationStatus === "valid"
				? "✅"
				: status.validationStatus === "invalid"
					? "❌"
					: "⏳";
		const validationStatusText =
			status.validationStatus === "valid"
				? "Valid"
				: status.validationStatus === "invalid"
					? "Invalid (please update)"
					: "Pending";

		const embed: APIEmbed = {
			title: "✅ Registration Status",
			description: "Your Tembo API key is registered and encrypted.",
			color: status.validationStatus === "valid" ? 0x00ff00 : 0xffa500, // Green or Orange
			fields: [
				{
					name: "👤 Tembo Account",
					value:
						`**User ID:** \`${status.temboUserId || "N/A"}\`\n` +
						`**Org ID:** \`${status.temboOrgId || "N/A"}\`${status.temboEmail ? `\n**Email:** ${status.temboEmail}` : ""}`,
					inline: false,
				},
				{
					name: "📅 Registration Info",
					value:
						`**Registered:** ${status.registrationTimestamp ? `<t:${Math.floor(status.registrationTimestamp / 1000)}:R>` : "N/A"}\n` +
						`**Last Used:** ${status.lastUsedTimestamp ? `<t:${Math.floor(status.lastUsedTimestamp / 1000)}:R>` : "N/A"}\n` +
						`**Last Validated:** ${status.lastValidatedTimestamp ? `<t:${Math.floor(status.lastValidatedTimestamp / 1000)}:R>` : "Never"}`,
					inline: false,
				},
				{
					name: "✔️ Validation Status",
					value: `${validationStatusEmoji} ${validationStatusText}`,
					inline: false,
				},
			],
			footer: {
				text: "Use /setup to update • /unregister to remove",
			},
			timestamp: new Date().toISOString(),
		};

		// Add warning if key is invalid
		if (status.validationStatus === "invalid") {
			embed.fields?.push({
				name: "⚠️ Action Required",
				value:
					"Your API key appears to be invalid or expired. Please update it using `/setup key:YOUR_NEW_API_KEY`",
				inline: false,
			});
		}

		logger.info("Status command completed", { userId, registered: true });

		return this.createEmbedResponse([embed], true); // Ephemeral
	}
}
