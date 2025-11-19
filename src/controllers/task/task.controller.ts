import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
	APIApplicationCommandAutocompleteInteraction,
	APIApplicationCommandInteractionDataOption,
	APIMessageComponentInteraction,
	APIApplicationCommandInteractionDataStringOption,
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
import type { Env } from "../../types";
import { updateInteractionResponse } from "../../utils/discord";

const AGENTS = [
	// Claude Code
	{ name: "Claude Code (Default) - Balanced", value: "claudeCode:claude-4-5-sonnet" },
	{ name: "Claude Code - Fastest", value: "claudeCode:claude-4-5-haiku" },
	{ name: "Claude Code - Complex Tasks", value: "claudeCode:claude-4.1-opus" },
	{ name: "Claude Code - Efficient", value: "claudeCode:claude-4-sonnet" },
	
	// Codex
	{ name: "Codex (Default) - Balanced", value: "codex:gpt-5-medium" },
	{ name: "Codex - Fastest", value: "codex:gpt-5-minimal" },
	{ name: "Codex - Quick", value: "codex:gpt-5-low" },
	{ name: "Codex - Deep Reasoning", value: "codex:gpt-5-high" },
	{ name: "Codex - Code Gen", value: "codex:gpt-5-codex" },

	// Opencode
	{ name: "Opencode (Default) - Balanced", value: "opencode:claude-4-5-sonnet" },
	{ name: "Opencode - Fastest", value: "opencode:claude-4-5-haiku" },
	{ name: "Opencode - Complex Tasks", value: "opencode:claude-4.1-opus" },
	{ name: "Opencode - Efficient", value: "opencode:claude-4-sonnet" },

	// Amp
	{ name: "Amp - Smart Detection", value: "amp:claude-4-5-sonnet" },

	// Cursor
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
				// We know repositories is a string option
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
	): Promise<APIInteractionResponse> {
		const customId = interaction.data.custom_id;
		const userId =
			interaction.member?.user?.id ?? interaction.user?.id ?? "unknown";

		if (customId.startsWith("task_list_")) {
			// Format: task_list_<page>
			const parts = customId.split("_");
			// Check if we have enough parts
			if (parts.length < 3) {
				return this.createErrorResponse("Invalid button ID format");
			}
			const page = parseInt(parts[2] ?? "");

			if (isNaN(page)) {
				return this.createErrorResponse("Invalid page number");
			}

			const params = { page, limit: 10 };
			// Note: Component interactions also have a 3s timeout. 
			// Ideally we should defer here too, but keeping it simple for now.
			const response = await this.generateTaskListResponse(
				params,
				userId,
				false, // Ephemeral flag doesn't matter for UpdateMessage
				Date.now(),
				true, // isUpdate
			);

			return response;
		}

		return super.handleComponent(interaction);
	}

	private async handleRepositoriesAutocomplete(
		currentValue: string,
	): Promise<APIInteractionResponse> {
		try {
			// Fetch repositories from Tembo
			const result = await this.temboService.listRepositories();
			const repos = result.codeRepositories;

			const filtered = repos
				.filter((repo) =>
					repo.url.toLowerCase().includes(currentValue.toLowerCase()),
				)
				.slice(0, 21) // Limit to 21
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
			.slice(0, 25); // Discord limit is 25

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
				`${params.repositories && params.repositories.length > 0 ? `**Repositories:** ${params.repositories.length}\n` : ""}` +
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
			return this.createDeferredResponse(ephemeral);
		}

		return this.generateTaskListResponse(params, userId, ephemeral, startTime);
	}

	private async processTaskList(
		params: any,
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
				const embed = {
					title: "📝 Your Tembo Tasks",
					description: `Showing ${result.issues.length} task(s)`,
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
							? `Page ${result.meta.currentPage} of ${result.meta.totalPages} • ${result.meta.totalCount} total tasks`
							: `${result.issues.length} tasks`,
					},
				};

				const components: any[] = [];
				if (result.meta && result.meta.totalPages > 1) {
					const currentPage = result.meta.currentPage;
					const totalPages = result.meta.totalPages;

					components.push({
						type: ComponentType.ActionRow,
						components: [
							{
								type: ComponentType.Button,
								custom_id: `task_list_${currentPage - 1}`,
								label: "Previous",
								style: ButtonStyle.Secondary,
								disabled: currentPage <= 1,
							},
							{
								type: ComponentType.Button,
								custom_id: `task_list_${currentPage + 1}`,
								label: "Next",
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
		params: any,
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

		const embed = {
			title: "📝 Your Tembo Tasks",
			description: `Showing ${result.issues.length} task(s)`,
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
					? `Page ${result.meta.currentPage} of ${result.meta.totalPages} • ${result.meta.totalCount} total tasks`
					: `${result.issues.length} tasks`,
			},
		};

		const components: any[] = [];
		if (result.meta && result.meta.totalPages > 1) {
			const currentPage = result.meta.currentPage;
			const totalPages = result.meta.totalPages;

			components.push({
				type: ComponentType.ActionRow,
				components: [
					{
						type: ComponentType.Button,
						custom_id: `task_list_${currentPage - 1}`,
						label: "Previous",
						style: ButtonStyle.Secondary,
						disabled: currentPage <= 1,
					},
					{
						type: ComponentType.Button,
						custom_id: `task_list_${currentPage + 1}`,
						label: "Next",
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
			return this.createDeferredResponse(ephemeral);
		}

		return this.generateSearchResponse(params, userId, ephemeral, startTime);
	}

	private async processTaskSearch(
		params: any,
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
				const embed = {
					title: `🔍 Search Results: "${params.query}"`,
					description: `Found ${result.issues.length} matching task(s)`,
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
							? `Page ${result.meta.currentPage} of ${result.meta.totalPages} • ${result.meta.totalCount} total results`
							: `${result.issues.length} results`,
					},
				};
				body = {
					embeds: [embed],
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
		params: any,
		userId: string,
		ephemeral: boolean,
		startTime: number,
	): Promise<APIInteractionResponse> {
		logger.info("Processing task search command", {
			userId,
			query: params.query,
			page: params.page,
			limit: params.limit,
			ephemeral,
		});

		const result = await this.temboService.searchTasks(params);
		const duration = Date.now() - startTime;
		logger.command("task search", userId, true, duration);

		if (!result.issues || result.issues.length === 0) {
			return this.createSuccessResponse(
				`🔍 No tasks found matching "${params.query}".\n\nTry a different search query or create a new task with \`/task create\`.`,
				ephemeral,
			);
		}

		const embed = {
			title: `🔍 Search Results: "${params.query}"`,
			description: `Found ${result.issues.length} matching task(s)`,
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
					? `Page ${result.meta.currentPage} of ${result.meta.totalPages} • ${result.meta.totalCount} total results`
					: `${result.issues.length} results`,
			},
		};

		return this.createEmbedResponse([embed], ephemeral);
	}
}
