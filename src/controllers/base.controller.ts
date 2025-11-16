import type {
	APIChatInputApplicationCommandInteraction,
	APIInteractionResponse,
	APIApplicationCommandInteractionDataOption,
} from "discord-api-types/v10";
import {
	InteractionResponseType,
	ApplicationCommandOptionType,
} from "discord-api-types/v10";
import { TemboService } from "../services/tembo.service";
import { logger } from "../utils/logger";
import { formatErrorForUser } from "../utils/errors";

export abstract class BaseController {
	constructor(protected readonly temboService: TemboService) {}

	protected getOptionsMap(
		options: APIApplicationCommandInteractionDataOption[] | undefined,
	): Record<string, unknown> {
		if (!options || !Array.isArray(options)) {
			return {};
		}

		const map: Record<string, unknown> = {};
		for (const option of options) {
			if (
				option.type === ApplicationCommandOptionType.Subcommand &&
				"options" in option &&
				option.options
			) {
				for (const subOption of option.options) {
					if ("value" in subOption) {
						map[subOption.name] = subOption.value;
					}
				}
			} else if ("value" in option) {
				map[option.name] = option.value;
			}
		}

		return map;
	}

	protected getSubcommandName(
		options: APIApplicationCommandInteractionDataOption[] | undefined,
	): string | undefined {
		if (!options || !Array.isArray(options)) {
			return undefined;
		}

		for (const option of options) {
			if (option.type === ApplicationCommandOptionType.Subcommand) {
				return option.name;
			}
		}

		return undefined;
	}

	protected getEphemeralFlag(
		options: APIApplicationCommandInteractionDataOption[] | undefined,
	): boolean {
		const optionsMap = this.getOptionsMap(options);
		return optionsMap.ephemeral === true;
	}

	protected createSuccessResponse(
		content: string,
		ephemeral: boolean = false,
	): APIInteractionResponse {
		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content,
				flags: ephemeral ? 64 : undefined,
			},
		};
	}

	protected createErrorResponse(content: string): APIInteractionResponse {
		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: `❌ ${content}`,
				flags: 64,
			},
		};
	}

	protected createEmbedResponse(
		embeds: any[],
		ephemeral: boolean = false,
	): APIInteractionResponse {
		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				embeds,
				flags: ephemeral ? 64 : undefined,
			},
		};
	}

	protected handleError(
		error: unknown,
		commandName: string,
		userId: string,
	): APIInteractionResponse {
		logger.error(`Error in ${commandName} command`, error, {
			command: commandName,
			userId,
		});

		const message = formatErrorForUser(error);
		return this.createErrorResponse(message);
	}

	abstract handle(
		interaction: APIChatInputApplicationCommandInteraction,
		ctx?: ExecutionContext,
	): Promise<APIInteractionResponse>;
}
