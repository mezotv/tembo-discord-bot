import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
	APIEmbed,
} from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import type { Env } from "../../types";
import packageJson from "../../../package.json";

// Import version from package.json at build time
const BOT_VERSION = packageJson.version ?? "unknown";
const START_TIME = Date.now();

export class VersionController extends BaseController {
	constructor() {
		// Version doesn't need TemboService
		super(null);
	}

	private formatUptime(uptimeMs: number): string {
		const seconds = Math.floor(uptimeMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		const parts: string[] = [];
		if (days > 0) parts.push(`${days}d`);
		if (hours % 24 > 0) parts.push(`${hours % 24}h`);
		if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
		if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

		return parts.length > 0 ? parts.join(" ") : "< 1s";
	}

	async handle(
		interaction: APIChatInputApplicationCommandInteraction,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const uptime = Date.now() - START_TIME;
		const uptimeFormatted = this.formatUptime(uptime);

		const embed: APIEmbed = {
			title: "🤖 Tembo Discord Bot - Version Information",
			description:
				"A powerful Discord bot for managing your Tembo tasks and repositories directly from Discord.",
			color: 0x5865f2, // Discord Blurple
			fields: [
				{
					name: "📦 Version",
					value: `\`${BOT_VERSION}\``,
					inline: true,
				},
				{
					name: "⏱️ Uptime",
					value: uptimeFormatted,
					inline: true,
				},
				{
					name: "⚡ Runtime",
					value: "Cloudflare Workers",
					inline: true,
				},
				{
					name: "🛠️ Framework",
					value: "Hono.js + Discord.js API",
					inline: true,
				},
				{
					name: "🔗 Tembo SDK Version",
					value: "^0.1.2",
					inline: true,
				},
				{
					name: "📡 API Version",
					value: "Discord API v10",
					inline: true,
				},
				{
					name: "✨ Features",
					value:
						"• Task Management\n" +
						"• Repository Integration\n" +
						"• Secure API Key Storage (AES-256-GCM)\n" +
						"• 29+ AI Agents Support\n" +
						"• Autocomplete for Repositories & Agents\n" +
						"• Works in Servers, DMs, and Private Channels",
					inline: false,
				},
				{
					name: "🔗 Links",
					value:
						"[Tembo Dashboard](https://app.tembo.io) • [GitHub Repository](https://github.com/mezotv/tembo-discord-bot) • [Documentation](https://docs.tembo.io)",
					inline: false,
				},
			],
			footer: {
				text: "Tembo Discord Bot • Made with ❤️",
			},
			timestamp: new Date().toISOString(),
		};

		return this.createEmbedResponse([embed], false);
	}
}
