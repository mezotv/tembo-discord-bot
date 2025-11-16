import type { APIInteractionResponse } from "discord-api-types/v10";
import { logger } from "./logger";
import { formatErrorForUser } from "./errors";
import { InteractionResponseType } from "discord-api-types/v10";

export function asyncHandler(
	handler: () => Promise<APIInteractionResponse>,
	commandName: string,
	userId: string,
): Promise<APIInteractionResponse> {
	return handler().catch((error: unknown) => {
		logger.error(`Error in ${commandName} command`, error, {
			command: commandName,
			userId,
		});

		const message = formatErrorForUser(error);
		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: `❌ ${message}`,
				flags: 64,
			},
		};
	});
}
