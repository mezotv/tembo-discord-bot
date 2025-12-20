import type {
	APIInteractionResponse,
	APIEmbed,
	RESTPatchAPIWebhookWithTokenMessageJSONBody,
} from "discord-api-types/v10";
import { logger } from "./logger";

export async function updateInteractionResponse(
	applicationId: string,
	interactionToken: string,
	body: RESTPatchAPIWebhookWithTokenMessageJSONBody,
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

/**
 * Sends a direct message to a Discord user
 * @param userId Discord user ID
 * @param botToken Discord bot token
 * @param content Message content (text)
 * @param embeds Optional embeds
 * @returns Success status and error message if failed
 */
export async function sendDirectMessage(
	userId: string,
	botToken: string,
	content: string,
	embeds?: APIEmbed[],
): Promise<{ success: boolean; error?: string }> {
	try {
		// Step 1: Create DM channel with the user
		logger.info("Creating DM channel", { userId });
		const createDMResponse = await fetch(
			"https://discord.com/api/v10/users/@me/channels",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bot ${botToken}`,
				},
				body: JSON.stringify({ recipient_id: userId }),
			},
		);

		if (!createDMResponse.ok) {
			const errorText = await createDMResponse.text();
			logger.error("Failed to create DM channel", new Error(errorText), {
				status: createDMResponse.status,
				userId,
			});
			return {
				success: false,
				error: `Failed to create DM channel (${createDMResponse.status})`,
			};
		}

		const dmChannel = (await createDMResponse.json()) as { id: string };
		logger.info("DM channel created", { userId, channelId: dmChannel.id });

		// Step 2: Send message to the DM channel
		const sendMessageResponse = await fetch(
			`https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bot ${botToken}`,
				},
				body: JSON.stringify({
					content,
					embeds: embeds ?? [],
				}),
			},
		);

		if (!sendMessageResponse.ok) {
			const errorText = await sendMessageResponse.text();
			logger.error("Failed to send DM", new Error(errorText), {
				status: sendMessageResponse.status,
				userId,
				channelId: dmChannel.id,
			});
			return {
				success: false,
				error: `Failed to send message (${sendMessageResponse.status})`,
			};
		}

		logger.info("DM sent successfully", { userId });
		return { success: true };
	} catch (error) {
		logger.error("Exception while sending DM", error, { userId });
		return { success: false, error: "Unexpected error occurred" };
	}
}

/**
 * Triggers the onboarding flow by sending a DM to the user with setup instructions
 * @param userId Discord user ID
 * @param botToken Discord bot token
 */
export async function triggerOnboarding(
	userId: string,
	botToken: string,
): Promise<void> {
	logger.info("Triggering onboarding flow", { userId });

	const embed: APIEmbed = {
		title: "🔐 Welcome to Tembo Discord Bot!",
		description:
			"To use Tembo commands, you need to register your Tembo API key.",
		color: 0x5865f2, // Discord blurple
		fields: [
			{
				name: "📝 How to get your API key",
				value:
					"1. Visit [Tembo Dashboard](https://app.tembo.io)\n" +
					"2. Navigate to **Settings** → **API Keys**\n" +
					"3. Generate a new API key (or copy an existing one)\n" +
					"4. Copy the entire key\n" +
					"_Direct link: https://app.tembo.io/<your_workspace>/settings/api-keys_",
				inline: false,
			},
			{
				name: "🔧 How to register",
				value:
					"Use the `/setup` command in any channel or DM:\n" +
					"```\n/setup key:YOUR_API_KEY_HERE\n```\n" +
					"**Important:** Your API key is encrypted using AES-256-GCM and stored securely.",
				inline: false,
			},
			{
				name: "🚀 What you can do after registering",
				value:
					"• Create and manage Tembo tasks\n" +
					"• Search through your tasks\n" +
					"• List your code repositories\n" +
					"• Check your account status",
				inline: false,
			},
			{
				name: "🔐 Security",
				value:
					"• Your API key is encrypted before storage\n" +
					"• Only you can access your Tembo account\n" +
					"• Never share your API key with anyone\n" +
					"• Use `/unregister` to remove your key anytime",
				inline: false,
			},
		],
		footer: {
			text: "Your API key will be validated before registration",
		},
		timestamp: new Date().toISOString(),
	};

	const result = await sendDirectMessage(userId, botToken, "", [embed]);

	if (!result.success) {
		logger.warn("Failed to send onboarding DM - user may have DMs disabled", {
			userId,
			error: result.error,
		});
		// Note: The user will see a fallback message in the channel response
		// telling them to run /setup manually
	} else {
		logger.info("Onboarding DM sent successfully", { userId });
	}
}








