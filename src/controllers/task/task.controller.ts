import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
	APIApplicationCommandAutocompleteInteraction,
	APIApplicationCommandInteractionDataOption,
	APIMessageComponentInteraction,
	APIApplicationCommandInteractionDataStringOption,
	APIEmbed,
	APIActionRowComponent,
	APIButtonComponent,
} from "discord-api-types/v10";
import {
	InteractionResponseType,
	ApplicationCommandOptionType,
	ButtonStyle,
	ComponentType,
} from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import {
	validateCreateTaskParams,
	validateListTasksParams,
	validateSearchTasksParams,
} from "../../validation/command-options";
import { logger } from "../../utils/logger";
import { ValidationError } from "../../utils/errors";
import type { Env, ListTasksParams, SearchTasksParams } from "../../types";
import { updateInteractionResponse } from "../../utils/discord";

const AGENTS = [
	{ name: "Claude Code - Opus 4.5", value: "claudeCode:opus-4-5" },
	{ name: "Claude Code - Sonnet 4.5", value: "claudeCode:sonnet-4-5" },
	{ name: "Claude Code - Opus 4.1", value: "claudeCode:opus-4-1" },
	{ name: "Claude Code - Haiku 4.5", value: "claudeCode:haiku-4-5" },
	{ name: "Claude Code - Sonnet 4", value: "claudeCode:sonnet-4" },

	{ name: "OpenCode - Opus 4.5", value: "opencode:opus-4-5" },
	{ name: "OpenCode - Sonnet 4.5", value: "opencode:sonnet-4-5" },
	{ name: "OpenCode - Opus 4.1", value: "opencode:opus-4-1" },
	{ name: "OpenCode - Haiku 4.5", value: "opencode:haiku-4-5" },
	{ name: "OpenCode - Sonnet 4", value: "opencode:sonnet-4" },

	{ name: "Cursor - Opus 4.5", value: "cursor:opus-4-5" },
	{ name: "Cursor - Sonnet 4.5", value: "cursor:sonnet-4-5" },
	{ name: "Cursor - Opus 4.1", value: "cursor:opus-4-1" },
	{ name: "Cursor - Haiku 4.5", value: "cursor:haiku-4-5" },
	{ name: "Cursor - Sonnet 4", value: "cursor:sonnet-4" },

	{ name: "Amp - Opus 4.5", value: "amp:opus-4-5" },
];

function getStatusEmoji(status: string | undefined): string {
	if (!status) return "⚪";

	const statusLower = status.toLowerCase();

	if (statusLower.includes("finished") || statusLower.includes("complete") || statusLower.includes("done")) {
		return "✅";
	}
	if (statusLower.includes("failed") || statusLower.includes("error")) {
		return "❌";
	}
	if (statusLower.includes("running") || statusLower.includes("processing") || statusLower.includes("in progress")) {
		return "🔄";
	}
	if (statusLower.includes("pending") || statusLower.includes("queued") || statusLower.includes("waiting")) {
		return "⏳";
	}
	if (statusLower.includes("cancelled") || statusLower.includes("canceled")) {
		return "⚠️";
	}

	return "⚪";
}

export class TaskController extends BaseController {
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
			throw new ValidationError(
				"No subcommand specified. Use: create, list, or search",
			);
		}

		switch (subcommand) {
			case "create":
				return this.handleCreate(interaction, ctx, userId, startTime);
			case "list":
				return this.handleList(interaction, userId, startTime, ctx, env);
			case "search":
				return this.handleSearch(interaction, userId, startTime, ctx, env);
			default:
				throw new ValidationError(
					`Unknown subcommand: ${subcommand}. Use: create, list, or search`,
				);
		}
	}

	override async handleAutocomplete(
		interaction: APIApplicationCommandAutocompleteInteraction,
	): Promise<APIInteractionResponse> {
		const subcommand = this.getSubcommandName(interaction.data.options);

		if (subcommand === "create") {
			const focusedOption = this.getFocusedOption(interaction.data.options);

			if (focusedOption?.name === "repositories") {
				const value = (focusedOption as APIApplicationCommandInteractionDataStringOption).value;
				return this.handleRepositoriesAutocomplete(value);
			}
			if (focusedOption?.name === "agent") {
				const value = (focusedOption as APIApplicationCommandInteractionDataStringOption).value;
				return this.handleAgentsAutocomplete(value);
			}
		}

		return {
			type: InteractionResponseType.ApplicationCommandAutocompleteResult,
			data: { choices: [] },
		};
	}

	override async handleComponent(
		interaction: APIMessageComponentInteraction,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const customId = interaction.data.custom_id;
		const userId =
			interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";
		const applicationId = env?.DISCORD_APPLICATION_ID;
		const interactionToken = interaction.token;

		if (customId.startsWith("task_list_")) {
			const parts = customId.split("_");
			const page = parseInt(parts[2] ?? "");

			if (isNaN(page)) {
				return this.createErrorResponse("Invalid page number");
			}

			const params: ListTasksParams = { page, limit: 10 };

			if (ctx && applicationId) {
				ctx.waitUntil(
					this.processTaskList(
						params,
						userId,
						false, // Not ephemeral for component updates
						Date.now(),
						applicationId,
						interactionToken,
					),
				);
				return this.createDeferredUpdateResponse();
			}

			return this.generateTaskListResponse(
				params,
				userId,
				false, 
				Date.now(),
				true, 
			);
		}

		if (customId.startsWith("task_search_")) {
			const parts = customId.split("_");
			const page = parseInt(parts[2] ?? "");
			const query = parts.slice(3).join("_");

			if (isNaN(page)) {
				return this.createErrorResponse("Invalid page number");
			}

			if (!query) {
				return this.createErrorResponse("Invalid search query");
			}

			const params: SearchTasksParams = { query, page, limit: 10 };

			if (ctx && applicationId) {
				ctx.waitUntil(
					this.processTaskSearch(
						params,
						userId,
						false, // Not ephemeral for component updates
						Date.now(),
						applicationId,
						interactionToken,
					),
				);
				return this.createDeferredUpdateResponse();
			}

			return this.generateSearchResponse(
				params,
				userId,
				false,
				Date.now(),
				true,
			);
		}

		return super.handleComponent(interaction, ctx, env);
	}

	private async handleRepositoriesAutocomplete(
		currentValue: string,
	): Promise<APIInteractionResponse> {
		try {
			const result = await this.getTemboService().listRepositories();
			const repos = result.codeRepositories;

			const filtered = repos
				.filter((repo) =>
					repo.url.toLowerCase().includes(currentValue.toLowerCase()),
				)
				.slice(0, 21) 
				.map((repo) => ({
					name: repo.url,
					value: repo.url,
				}));

			return {
				type: InteractionResponseType.ApplicationCommandAutocompleteResult,
				data: {
					choices: filtered,
				},
			};
		} catch (error) {
			logger.error("Failed to autocomplete repositories", error);
			return {
				type: InteractionResponseType.ApplicationCommandAutocompleteResult,
				data: { choices: [] },
			};
		}
	}

	private async handleAgentsAutocomplete(
		currentValue: string,
	): Promise<APIInteractionResponse> {
		const filtered = AGENTS
			.filter((agent) =>
				agent.name.toLowerCase().includes(currentValue.toLowerCase()) ||
				agent.value.toLowerCase().includes(currentValue.toLowerCase())
			)
			.slice(0, 25); 

		return {
			type: InteractionResponseType.ApplicationCommandAutocompleteResult,
			data: {
				choices: filtered,
			},
		};
	}

	private getFocusedOption(
		options: APIApplicationCommandInteractionDataOption[] | undefined,
	): APIApplicationCommandInteractionDataOption | undefined {
		if (!options) return undefined;

		for (const option of options) {
			if (
				option.type === ApplicationCommandOptionType.Subcommand &&
				option.options
			) {
				for (const subOption of option.options) {
					if ("focused" in subOption && subOption.focused === true) {
						return subOption;
					}
				}
			} else if ("focused" in option && option.focused === true) {
				return option;
			}
		}
		return undefined;
	}

	private async handleCreate(
		interaction: APIChatInputApplicationCommandInteraction,
		ctx: ExecutionContext | undefined,
		userId: string,
		startTime: number,
	): Promise<APIInteractionResponse> {
		const optionsMap = this.getOptionsMap(interaction.data.options);
		const params = validateCreateTaskParams(optionsMap);
		const ephemeral = this.getEphemeralFlag(interaction.data.options);

		logger.info("Processing task create command", {
			userId,
			promptLength: params.prompt.length,
			agent: params.agent,
			repositoryCount: params.repositories?.length ?? 0,
			ephemeral,
		});

		if (ctx) {
			const taskPromise = this.getTemboService()
				.createTask(params)
				.catch((error) => {
					logger.error("Background task creation failed", error, {
						userId,
						command: "task create",
					});
				});

			ctx.waitUntil(taskPromise);
		}

		const duration = Date.now() - startTime;
		logger.command("task create", userId, true, duration);

		const repoList = params.repositories.length <= 3
			? params.repositories.map(r => `  • ${r}`).join("\n")
			: `  • ${params.repositories[0]}\n  • ${params.repositories[1]}\n  • ${params.repositories[2]}\n  • ...and ${params.repositories.length - 3} more`;

		return this.createSuccessResponse(
			`✅ **Task Submitted Successfully!**\n\n` +
				`**📋 Task Details**\n` +
				`${params.prompt.substring(0, 200)}${params.prompt.length > 200 ? "..." : ""}\n\n` +
				`**⚙️ Configuration**\n` +
				`• **Agent:** ${params.agent || "Default (Claude Code)"}\n` +
				`• **Repositories:** ${params.repositories.length}\n${repoList}\n` +
				`${params.branch ? `• **Branch:** ${params.branch}\n` : ""}` +
				`${params.queueRightAway !== undefined ? `• **Queue Immediately:** ${params.queueRightAway ? "Yes" : "No"}\n` : ""}` +
				`\n**⏳ Next Steps**\n` +
				`1. Your task is being processed by Tembo\n` +
				`2. Use \`/task list\` to monitor progress\n` +
				`3. Check task status for completion`,
			ephemeral,
		);
	}

	private async handleList(
		interaction: APIChatInputApplicationCommandInteraction,
		userId: string,
		startTime: number,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const optionsMap = this.getOptionsMap(interaction.data.options);
		const params = validateListTasksParams(optionsMap);
		const ephemeral = this.getEphemeralFlag(interaction.data.options);
		const applicationId = env?.DISCORD_APPLICATION_ID;
		const interactionToken = interaction.token;

		if (ctx && applicationId) {
			ctx.waitUntil(
				this.processTaskList(
					params,
					userId,
					ephemeral,
					startTime,
					applicationId,
					interactionToken,
				),
			);
			// Return initial loading response
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: "🔄 Loading your tasks...",
					flags: ephemeral ? 64 : undefined,
				},
			};
		}

		return this.generateTaskListResponse(params, userId, ephemeral, startTime);
	}

	private async processTaskList(
		params: ListTasksParams,
		userId: string,
		ephemeral: boolean,
		startTime: number,
		applicationId: string,
		interactionToken: string,
	): Promise<void> {
		try {
			const result = await this.getTemboService().listTasks(params);
			const duration = Date.now() - startTime;
			logger.command("task list", userId, true, duration);

			let body;
			if (!result.issues || result.issues.length === 0) {
				body = {
					content:
						"📝 **No Tasks Found**\n\n" +
						"You don't have any tasks yet. Ready to get started?\n\n" +
						"**Getting Started:**\n" +
						"1. Use `/task create` to create your first task\n" +
						"2. Connect repositories with `/repositories list`\n" +
						"3. Need help? Try `/help`\n\n" +
						"**Example:**\n" +
						"`/task create prompt:\"Fix the login bug\" repositories:my-repo`",
					flags: ephemeral ? 64 : undefined,
				};
			} else {
				const currentPage = result.meta?.currentPage ?? 1;
				const totalPages = result.meta?.totalPages ?? 1;
				const totalCount = result.meta?.totalCount ?? result.issues.length;
				const startItem = ((currentPage - 1) * (result.meta?.pageSize ?? 10)) + 1;
				const endItem = startItem + result.issues.length - 1;

				const embed: APIEmbed = {
					title: "📝 Your Tembo Tasks",
					description: result.meta
						? `Showing ${startItem}-${endItem} of ${totalCount} total tasks`
						: `Showing ${result.issues.length} task(s)`,
					fields: result.issues.slice(0, 10).map((task) => {
						const repositories = (task.metadata?.repositories as string[]) ?? (task.data?.repositories as string[]);
						const repoInfo = repositories && Array.isArray(repositories)
							? repositories.length === 1
								? `**Repository:** ${repositories[0]}`
								: `**Repositories:** ${repositories.length} (${repositories.slice(0, 2).join(", ")}${repositories.length > 2 ? "..." : ""})`
							: null;

						return {
							name: task.title || task.prompt?.substring(0, 100) || "Untitled Task",
							value: [
								`**ID:** \`${task.id}\``,
								task.status ? `**Status:** ${getStatusEmoji(task.status)} ${task.status}` : "",
								repoInfo,
								task.agent ? `**Agent:** ${task.agent}` : "",
								task.createdAt
									? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`
									: "",
							]
								.filter(Boolean)
								.join("\n"),
							inline: false,
						};
					}),
					color: 0x5865f2,
					footer: {
						text: result.meta
							? `Page ${currentPage}/${totalPages}`
							: `${result.issues.length} tasks`,
					},
				};

				const components: APIActionRowComponent<APIButtonComponent>[] = [];
				if (result.meta && result.meta.totalPages > 1) {
					components.push({
						type: ComponentType.ActionRow,
						components: [
							{
								type: ComponentType.Button,
								custom_id: `task_list_${currentPage - 1}`,
								label: `← Page ${currentPage - 1}`,
								style: ButtonStyle.Secondary,
								disabled: currentPage <= 1,
							},
							{
								type: ComponentType.Button,
								custom_id: `task_list_${currentPage + 1}`,
								label: `Page ${currentPage + 1} →`,
								style: ButtonStyle.Secondary,
								disabled: currentPage >= totalPages,
							},
						],
					});
				}

				body = {
					embeds: [embed],
					components: components.length > 0 ? components : undefined,
					flags: ephemeral ? 64 : undefined,
				};
			}

			await updateInteractionResponse(applicationId, interactionToken, body);
		} catch (error) {
			logger.error("Failed to process task list in background", error);
			await updateInteractionResponse(applicationId, interactionToken, {
				content: "❌ Failed to retrieve tasks.",
				flags: 64,
			});
		}
	}

	private async generateTaskListResponse(
		params: ListTasksParams,
		userId: string,
		ephemeral: boolean,
		startTime: number,
		isUpdate: boolean = false,
	): Promise<APIInteractionResponse> {
		logger.info("Processing task list command", {
			userId,
			page: params.page,
			limit: params.limit,
			ephemeral,
			isUpdate,
		});

		const result = await this.getTemboService().listTasks(params);

		const duration = Date.now() - startTime;
		logger.command("task list", userId, true, duration);

		if (!result.issues || result.issues.length === 0) {
			const msg =
				"📝 **No Tasks Found**\n\n" +
				"You don't have any tasks yet. Ready to get started?\n\n" +
				"**Getting Started:**\n" +
				"1. Use `/task create` to create your first task\n" +
				"2. Connect repositories with `/repositories list`\n" +
				"3. Need help? Try `/help`\n\n" +
				"**Example:**\n" +
				"`/task create prompt:\"Fix the login bug\" repositories:my-repo`";
			if (isUpdate) {
				return this.createUpdateMessageResponse([], []);
			}
			return this.createSuccessResponse(msg, ephemeral);
		}

		const currentPage = result.meta?.currentPage ?? 1;
		const totalPages = result.meta?.totalPages ?? 1;
		const totalCount = result.meta?.totalCount ?? result.issues.length;
		const startItem = ((currentPage - 1) * (result.meta?.pageSize ?? 10)) + 1;
		const endItem = startItem + result.issues.length - 1;

		const embed: APIEmbed = {
			title: "📝 Your Tembo Tasks",
			description: result.meta
				? `Showing ${startItem}-${endItem} of ${totalCount} total tasks`
				: `Showing ${result.issues.length} task(s)`,
			fields: result.issues.slice(0, 10).map((task) => {
				const repositories = (task.metadata?.repositories as string[]) ?? (task.data?.repositories as string[]);
				const repoInfo = repositories && Array.isArray(repositories)
					? repositories.length === 1
						? `**Repository:** ${repositories[0]}`
						: `**Repositories:** ${repositories.length} (${repositories.slice(0, 2).join(", ")}${repositories.length > 2 ? "..." : ""})`
					: null;

				return {
					name: task.title || task.prompt?.substring(0, 100) || "Untitled Task",
					value: [
						`**ID:** \`${task.id}\``,
						task.status ? `**Status:** ${getStatusEmoji(task.status)} ${task.status}` : "",
						repoInfo,
						task.agent ? `**Agent:** ${task.agent}` : "",
						task.createdAt
							? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`
							: "",
					]
						.filter(Boolean)
						.join("\n"),
					inline: false,
				};
			}),
			color: 0x5865f2,
			footer: {
				text: result.meta
					? `Page ${currentPage}/${totalPages}`
					: `${result.issues.length} tasks`,
			},
		};

		const components: APIActionRowComponent<APIButtonComponent>[] = [];
		if (result.meta && result.meta.totalPages > 1) {
			components.push({
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						custom_id: `task_list_${currentPage - 1}`,
						label: `← Page ${currentPage - 1}`,
						style: ButtonStyle.Secondary,
						disabled: currentPage <= 1,
					},
					{
						type: ComponentType.Button,
						custom_id: `task_list_${currentPage + 1}`,
						label: `Page ${currentPage + 1} →`,
						style: ButtonStyle.Secondary,
						disabled: currentPage >= totalPages,
					},
				],
			});
		}

		if (isUpdate) {
			return this.createUpdateMessageResponse([embed], components);
		}

		return this.createEmbedResponse([embed], ephemeral, components);
	}

	private async handleSearch(
		interaction: APIChatInputApplicationCommandInteraction,
		userId: string,
		startTime: number,
		ctx?: ExecutionContext,
		env?: Env,
	): Promise<APIInteractionResponse> {
		const optionsMap = this.getOptionsMap(interaction.data.options);
		const params = validateSearchTasksParams(optionsMap);
		const ephemeral = this.getEphemeralFlag(interaction.data.options);
		const applicationId = env?.DISCORD_APPLICATION_ID;
		const interactionToken = interaction.token;

		if (ctx && applicationId) {
			ctx.waitUntil(
				this.processTaskSearch(
					params,
					userId,
					ephemeral,
					startTime,
					applicationId,
					interactionToken,
				),
			);
			// Return initial loading response
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: `🔍 Searching for "${params.query}"...`,
					flags: ephemeral ? 64 : undefined,
				},
			};
		}

		return this.generateSearchResponse(params, userId, ephemeral, startTime);
	}

	private async processTaskSearch(
		params: SearchTasksParams,
		userId: string,
		ephemeral: boolean,
		startTime: number,
		applicationId: string,
		interactionToken: string,
	): Promise<void> {
		logger.info("DEBUG: Starting task search processing", {
			query: params.query,
			page: params.page,
			limit: params.limit,
			userId,
			ephemeral,
		});

		try {
			logger.info("DEBUG: About to call searchTasks from controller", {
				query: params.query,
				page: params.page,
				limit: params.limit,
			});

			const result = await this.getTemboService().searchTasks(params);

			logger.info("DEBUG: searchTasks returned successfully to controller", {
				issuesCount: result.issues?.length ?? 0,
				hasMetahas: !!result.meta,
				query: result.query,
			});
			const duration = Date.now() - startTime;
			logger.command("task search", userId, true, duration);

			let body;
			if (!result.issues || result.issues.length === 0) {
				body = {
					content:
						`🔍 **No Results Found**\n\n` +
						`No tasks match your search: "${params.query}"\n\n` +
						`**Search Tips:**\n` +
						`• Try different keywords\n` +
						`• Use partial words (e.g., "bug" instead of "bugfix")\n` +
						`• Check task IDs with \`/task list\`\n\n` +
						`**Or create a new task:**\n` +
						`\`/task create prompt:"${params.query}"\``,
					flags: ephemeral ? 64 : undefined,
				};
			} else {
				const currentPage = result.meta?.currentPage ?? 1;
				const totalPages = result.meta?.totalPages ?? 1;
				const totalCount = result.meta?.totalCount ?? result.issues.length;
				const startItem = ((currentPage - 1) * (result.meta?.pageSize ?? 10)) + 1;
				const endItem = startItem + result.issues.length - 1;

				const embed: APIEmbed = {
					title: `🔍 Search Results: "${params.query}"`,
					description: result.meta
						? `Showing ${startItem}-${endItem} of ${totalCount} matching tasks`
						: `Found ${result.issues.length} matching task(s)`,
					fields: result.issues.slice(0, 10).map((task) => {
						const repositories = (task.metadata?.repositories as string[]) ?? (task.data?.repositories as string[]);
						const repoInfo = repositories && Array.isArray(repositories)
							? repositories.length === 1
								? `**Repository:** ${repositories[0]}`
								: `**Repositories:** ${repositories.length} (${repositories.slice(0, 2).join(", ")}${repositories.length > 2 ? "..." : ""})`
							: null;

						return {
							name: task.title || task.prompt?.substring(0, 100) || "Untitled Task",
							value: [
								`**ID:** \`${task.id}\``,
								task.status ? `**Status:** ${getStatusEmoji(task.status)} ${task.status}` : "",
								repoInfo,
								task.agent ? `**Agent:** ${task.agent}` : "",
								task.createdAt
									? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`
									: "",
							]
								.filter(Boolean)
								.join("\n"),
							inline: false,
						};
					}),
					color: 0x5865f2,
					footer: {
						text: result.meta
							? `Page ${currentPage}/${totalPages}`
							: `${result.issues.length} results`,
					},
				};

				const components: APIActionRowComponent<APIButtonComponent>[] = [];
				if (result.meta && result.meta.totalPages > 1) {
					const query = params.query;

					// Check custom_id length limit (100 chars)
					if (query.length <= 80) {
						components.push({
							type: ComponentType.ActionRow,
							components: [
								{
									type: ComponentType.Button,
									custom_id: `task_search_${currentPage - 1}_${query}`,
									label: `← Page ${currentPage - 1}`,
									style: ButtonStyle.Secondary,
									disabled: currentPage <= 1,
								},
								{
									type: ComponentType.Button,
									custom_id: `task_search_${currentPage + 1}_${query}`,
									label: `Page ${currentPage + 1} →`,
									style: ButtonStyle.Secondary,
									disabled: currentPage >= totalPages,
								},
							],
						});
					}
				}

				body = {
					embeds: [embed],
					components: components.length > 0 ? components : undefined,
					flags: ephemeral ? 64 : undefined,
				};
			}

			await updateInteractionResponse(applicationId, interactionToken, body);
		} catch (error) {
			logger.error("DEBUG: Task search failed in controller", {
				errorType: error instanceof Error ? error.constructor.name : typeof error,
				errorMessage: error instanceof Error ? error.message : String(error),
				errorStack: error instanceof Error ? error.stack : undefined,
				query: params.query,
				page: params.page,
				limit: params.limit,
				userId,
			});
			logger.error("Failed to process task search in background", error);
			await updateInteractionResponse(applicationId, interactionToken, {
				content: "❌ Failed to search tasks.",
				flags: 64,
			});
		}
	}

	private async generateSearchResponse(
		params: SearchTasksParams,
		userId: string,
		ephemeral: boolean,
		startTime: number,
		isUpdate: boolean = false,
	): Promise<APIInteractionResponse> {
		logger.info("Processing task search command", {
			userId,
			query: params.query,
			page: params.page,
			limit: params.limit,
			ephemeral,
			isUpdate,
		});

		const result = await this.getTemboService().searchTasks(params);
		const duration = Date.now() - startTime;
		logger.command("task search", userId, true, duration);

		if (!result.issues || result.issues.length === 0) {
			const msg =
				`🔍 **No Results Found**\n\n` +
				`No tasks match your search: "${params.query}"\n\n` +
				`**Search Tips:**\n` +
				`• Try different keywords\n` +
				`• Use partial words (e.g., "bug" instead of "bugfix")\n` +
				`• Check task IDs with \`/task list\`\n\n` +
				`**Or create a new task:**\n` +
				`\`/task create prompt:"${params.query}"\``;
			if (isUpdate) {
				return this.createUpdateMessageResponse([], []);
			}
			return this.createSuccessResponse(msg, ephemeral);
		}

		const currentPage = result.meta?.currentPage ?? 1;
		const totalPages = result.meta?.totalPages ?? 1;
		const totalCount = result.meta?.totalCount ?? result.issues.length;
		const startItem = ((currentPage - 1) * (result.meta?.pageSize ?? 10)) + 1;
		const endItem = startItem + result.issues.length - 1;

		const embed: APIEmbed = {
			title: `🔍 Search Results: "${params.query}"`,
			description: result.meta
				? `Showing ${startItem}-${endItem} of ${totalCount} matching tasks`
				: `Found ${result.issues.length} matching task(s)`,
			fields: result.issues.slice(0, 10).map((task) => {
				const repositories = (task.metadata?.repositories as string[]) ?? (task.data?.repositories as string[]);
				const repoInfo = repositories && Array.isArray(repositories)
					? repositories.length === 1
						? `**Repository:** ${repositories[0]}`
						: `**Repositories:** ${repositories.length} (${repositories.slice(0, 2).join(", ")}${repositories.length > 2 ? "..." : ""})`
					: null;

				return {
					name: task.title || task.prompt?.substring(0, 100) || "Untitled Task",
					value: [
						`**ID:** \`${task.id}\``,
						task.status ? `**Status:** ${getStatusEmoji(task.status)} ${task.status}` : "",
						repoInfo,
						task.agent ? `**Agent:** ${task.agent}` : "",
						task.createdAt
							? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`
							: "",
					]
						.filter(Boolean)
						.join("\n"),
					inline: false,
				};
			}),
			color: 0x5865f2,
			footer: {
				text: result.meta
					? `Page ${currentPage}/${totalPages}`
					: `${result.issues.length} results`,
			},
		};

		const components: APIActionRowComponent<APIButtonComponent>[] = [];
		if (result.meta && result.meta.totalPages > 1) {
			const query = params.query;

			// Check custom_id length limit (100 chars)
			if (query.length <= 80) {
				components.push({
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.Button,
							custom_id: `task_search_${currentPage - 1}_${query}`,
							label: `← Page ${currentPage - 1}`,
							style: ButtonStyle.Secondary,
							disabled: currentPage <= 1,
						},
						{
							type: ComponentType.Button,
							custom_id: `task_search_${currentPage + 1}_${query}`,
							label: `Page ${currentPage + 1} →`,
							style: ButtonStyle.Secondary,
							disabled: currentPage >= totalPages,
						},
					],
				});
			}
		}

		if (isUpdate) {
			return this.createUpdateMessageResponse([embed], components);
		}

		return this.createEmbedResponse([embed], ephemeral, components);
	}
}
