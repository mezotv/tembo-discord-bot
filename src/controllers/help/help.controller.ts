import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
	APIEmbed,
} from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import type { Env } from "../../types";

export class HelpController extends BaseController {
	constructor() {
		// Help doesn't need TemboService
		super(null);
	}

	async handle(
		interaction: APIChatInputApplicationCommandInteraction,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const embed: APIEmbed = {
			title: "📚 Tembo Discord Bot - Command Guide",
			description:
				"Manage your Tembo tasks directly from Discord. All commands work in servers, DMs, and private channels.",
			color: 0x5865f2, // Discord Blurple
			fields: [
				{
					name: "🔐 Authentication Commands",
					value:
						"**`/setup key:YOUR_API_KEY`**\n" +
						"Register or update your Tembo API key\n" +
						"_Example: `/setup key:tmb_1234abcd...`_\n\n" +
						"**`/status`**\n" +
						"Check your API key registration status\n\n" +
						"**`/unregister [confirm:true]`**\n" +
						"Remove your registered API key\n" +
						"_Requires confirmation to prevent accidents_",
					inline: false,
				},
				{
					name: "📝 Task Commands",
					value:
						"**`/task create prompt:TEXT repositories:URL`**\n" +
						"Create a new Tembo task (repository required)\n" +
						"_Optional: `agent`, `branch`, `ephemeral`_\n" +
						"_Example: `/task create prompt:Fix login bug repositories:https://github.com/user/repo`_\n" +
						"_💡 Tip: Use autocomplete to select from connected repos_\n\n" +
						"**`/task list [page] [limit]`**\n" +
						"View your tasks with pagination\n" +
						"_Example: `/task list page:2 limit:20`_\n\n" +
						"**`/task search query:TEXT`**\n" +
						"Search tasks by title or description\n" +
						"_Example: `/task search query:authentication`_",
					inline: false,
				},
				{
					name: "🗂️ Repository Commands",
					value:
						"**`/repositories list [ephemeral]`**\n" +
						"View all connected code repositories from your Tembo account\n\n" +
						"**`/whoami`** 🔒\n" +
						"Get your current Tembo account information (always private)",
					inline: false,
				},
				{
					name: "🤖 Available Agents",
					value:
						"Tembo supports 29+ AI agents including:\n" +
						"• `claudeCode:claude-4-5-sonnet` - Claude Code with Sonnet 4.5\n" +
						"• `codex:gpt-4` - OpenAI Codex with GPT-4\n" +
						"• `cursor:claude-sonnet-4-5` - Cursor with Claude\n" +
						"• `amp:*` - Anthropic Amp variants\n" +
						"_Use autocomplete in `/task create` to see all options_",
					inline: false,
				},
				{
					name: "💡 Tips",
					value:
						"• All sensitive commands (like `/setup`) are **ephemeral** (only you can see them)\n" +
						"• Use `ephemeral:true` on any command to make it private\n" +
						"• Your API key is encrypted with AES-256-GCM before storage\n" +
						"• Each Discord user has their own isolated Tembo account\n" +
						"• Use autocomplete for agents and repositories when creating tasks",
					inline: false,
				},
				{
					name: "🔗 Links",
					value:
						"[Tembo Dashboard](https://app.tembo.io) • [Get API Key](https://app.tembo.io/<your_workspace>/settings/api-keys) • [Documentation](https://docs.tembo.io)",
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
