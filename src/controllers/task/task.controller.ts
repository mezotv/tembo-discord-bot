import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
} from "discord-api-types/v10";
import { BaseController } from "../base.controller";
import {
	validateCreateTaskParams,
	validateListTasksParams,
	validateSearchTasksParams,
} from "../../validation/command-options";
import { logger } from "../../utils/logger";
import { ValidationError } from "../../utils/errors";

export class TaskController extends BaseController {
	async handle(
		interaction: APIChatInputApplicationCommandInteraction,
		ctx?: ExecutionContext,
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
				return this.handleList(interaction, userId, startTime);
			case "search":
				return this.handleSearch(interaction, userId, startTime);
			default:
				throw new ValidationError(
					`Unknown subcommand: ${subcommand}. Use: create, list, or search`,
				);
		}
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
	): Promise<APIInteractionResponse> {
		const optionsMap = this.getOptionsMap(interaction.data.options);
		const params = validateListTasksParams(optionsMap);
		const ephemeral = this.getEphemeralFlag(interaction.data.options);

		logger.info("Processing task list command", {
			userId,
			page: params.page,
			limit: params.limit,
			ephemeral,
		});

		const result = await this.temboService.listTasks(params);

		const duration = Date.now() - startTime;
		logger.command("task list", userId, true, duration);

		if (!result.issues || result.issues.length === 0) {
			return this.createSuccessResponse(
				"📝 No tasks found.\n\nCreate a new task with `/task create`.",
				ephemeral,
			);
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

		return this.createEmbedResponse([embed], ephemeral);
	}

	private async handleSearch(
		interaction: APIChatInputApplicationCommandInteraction,
		userId: string,
		startTime: number,
	): Promise<APIInteractionResponse> {
		const optionsMap = this.getOptionsMap(interaction.data.options);
		const params = validateSearchTasksParams(optionsMap);
		const ephemeral = this.getEphemeralFlag(interaction.data.options);

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
