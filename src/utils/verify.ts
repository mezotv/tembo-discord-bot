// Discord signature verification utilities

import { verifyKey } from 'discord-interactions';

/**
 * Verify Discord request signature
 * @param request The incoming request
 * @param publicKey Discord application public key
 * @returns true if signature is valid, false otherwise
 */
export async function verifyDiscordRequest(
  request: Request,
  publicKey: string
): Promise<boolean> {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  
  if (!signature || !timestamp) {
    return false;
  }
  
  try {
    const body = await request.clone().text();
    return verifyKey(body, signature, timestamp, publicKey);
  } catch (error) {
    console.error('Error verifying Discord request:', error);
    return false;
  }
}

