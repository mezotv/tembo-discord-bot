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
	{ name: "Claude Code (Default) - Balanced", value: "claudeCode:claude-4-5-sonnet" },
	{ name: "Claude Code - Fastest", value: "claudeCode:claude-4-5-haiku" },
	{ name: "Claude Code - Complex Tasks", value: "claudeCode:claude-4.1-opus" },
	{ name: "Claude Code - Efficient", value: "claudeCode:claude-4-sonnet" },
	
	{ name: "Codex (Default) - Balanced", value: "codex:gpt-5-medium" },
	{ name: "Codex - Fastest", value: "codex:gpt-5-minimal" },
	{ name: "Codex - Quick", value: "codex:gpt-5-low" },
	{ name: "Codex - Deep Reasoning", value: "codex:gpt-5-high" },
	{ name: "Codex - Code Gen", value: "codex:gpt-5-codex" },

	{ name: "Opencode (Default) - Balanced", value: "opencode:claude-4-5-sonnet" },
	{ name: "Opencode - Fastest", value: "opencode:claude-4-5-haiku" },
	{ name: "Opencode - Complex Tasks", value: "opencode:claude-4.1-opus" },
	{ name: "Opencode - Efficient", value: "opencode:claude-4-sonnet" },

	{ name: "Amp - Smart Detection", value: "amp:claude-4-5-sonnet" },

	{ name: "Cursor (Default) - Balanced", value: "cursor:claude-4-5-sonnet" },
	{ name: "Cursor - Complex Tasks", value: "cursor:claude-4.1-opus" },
	{ name: "Cursor - GPT-5.1", value: "cursor:gpt-5.1" },
	{ name: "Cursor - GPT-5.1 Code", value: "cursor:gpt-5.1-codex" },
	{ name: "Cursor - GPT-5.1 High", value: "cursor:gpt-5.1-codex-high" },
	{ name: "Cursor - Gemini 3 Pro", value: "cursor:gemini-3-pro" },
	{ name: "Cursor - Composer", value: "cursor:composer-1" },
	{ name: "Cursor - Grok", value: "cursor:grok" },
];

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
			const result = await this.temboService.listRepositories();
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
			const taskPromise = this.temboService
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

		return this.createSuccessResponse(
			`✅ Task submitted successfully!\n\n` +
				`**Task:** ${params.prompt.substring(0, 150)}${params.prompt.length > 150 ? "..." : ""}\n` +
				`${params.agent ? `**Agent:** ${params.agent}\n` : ""}` +
				`**Repositories:** ${params.repositories.length}\n` +
				`${params.branch ? `**Branch:** ${params.branch}\n` : ""}\n` +
				`⏳ The task is being created and will be processed by Tembo shortly.\n` +
				`Use \`/task list\` to see your tasks.`,
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
			const result = await this.temboService.listTasks(params);
			const duration = Date.now() - startTime;
			logger.command("task list", userId, true, duration);

			let body;
			if (!result.issues || result.issues.length === 0) {
				body = {
					content: "📝 No tasks found.\n\nCreate a new task with `/task create`.",
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
					fields: result.issues.slice(0, 10).map((task) => ({
						name: task.title || task.prompt?.substring(0, 100) || "Untitled Task",
						value: [
							`**ID:** \`${task.id}\``,
							task.status ? `**Status:** ${task.status}` : "",
							task.agent ? `**Agent:** ${task.agent}` : "",
							task.createdAt
								? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`
								: "",
						]
							.filter(Boolean)
							.join("\n"),
						inline: false,
					})),
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

		const result = await this.temboService.listTasks(params);

		const duration = Date.now() - startTime;
		logger.command("task list", userId, true, duration);

		if (!result.issues || result.issues.length === 0) {
			const msg = "📝 No tasks found.\n\nCreate a new task with `/task create`.";
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
			fields: result.issues.slice(0, 10).map((task) => ({
				name: task.title || task.prompt?.substring(0, 100) || "Untitled Task",
				value: [
					`**ID:** \`${task.id}\``,
					task.status ? `**Status:** ${task.status}` : "",
					task.agent ? `**Agent:** ${task.agent}` : "",
					task.createdAt
						? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`
						: "",
				]
					.filter(Boolean)
					.join("\n"),
				inline: false,
			})),
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
		try {
			const result = await this.temboService.searchTasks(params);
			const duration = Date.now() - startTime;
			logger.command("task search", userId, true, duration);

			let body;
			if (!result.issues || result.issues.length === 0) {
				body = {
					content: `🔍 No tasks found matching "${params.query}".\n\nTry a different search query or create a new task with \`/task create\`.`,
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
					fields: result.issues.slice(0, 10).map((task) => ({
						name: task.title || task.prompt?.substring(0, 100) || "Untitled Task",
						value: [
							`**ID:** \`${task.id}\``,
							task.status ? `**Status:** ${task.status}` : "",
							task.agent ? `**Agent:** ${task.agent}` : "",
							task.createdAt
								? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`
								: "",
						]
							.filter(Boolean)
							.join("\n"),
						inline: false,
					})),
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

		const result = await this.temboService.searchTasks(params);
		const duration = Date.now() - startTime;
		logger.command("task search", userId, true, duration);

		if (!result.issues || result.issues.length === 0) {
			const msg = `🔍 No tasks found matching "${params.query}".\n\nTry a different search query or create a new task with \`/task create\`.`;
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
			fields: result.issues.slice(0, 10).map((task) => ({
				name: task.title || task.prompt?.substring(0, 100) || "Untitled Task",
				value: [
					`**ID:** \`${task.id}\``,
					task.status ? `**Status:** ${task.status}` : "",
					task.agent ? `**Agent:** ${task.agent}` : "",
					task.createdAt
						? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>`
						: "",
				]
					.filter(Boolean)
					.join("\n"),
				inline: false,
			})),
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
