import type { APIInteractionResponse } from "discord-api-types/v10";
import { logger } from "./logger";

export async function updateInteractionResponse(
	applicationId: string,
	interactionToken: string,
	body: any,
): Promise<void> {
	const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;

	try {
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error("Failed to update interaction response", new Error(errorText), {
				status: response.status,
				url,
			});
		}
	} catch (error) {
		logger.error("Error updating interaction response", error);
	}
}



