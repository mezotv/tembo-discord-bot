import { verifyKey } from "discord-interactions";

export async function verifyDiscordRequest(
	request: Request,
	publicKey: string,
): Promise<boolean> {
	const signature = request.headers.get("X-Signature-Ed25519");
	const timestamp = request.headers.get("X-Signature-Timestamp");

	if (!signature || !timestamp) {
		return false;
	}

	const body = await request.clone().text();
	return verifyKey(body, signature, timestamp, publicKey);
}
