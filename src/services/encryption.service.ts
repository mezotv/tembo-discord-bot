/**
 * EncryptionService
 *
 * Handles AES-256-GCM encryption/decryption of Tembo API keys using Workers Crypto API.
 * Each encryption uses unique IV and salt for maximum security.
 * Additional authenticated data (Discord user ID) prevents ciphertext tampering.
 */

export interface EncryptedData {
	ciphertext: string; // base64-encoded
	iv: string; // base64-encoded initialization vector (12 bytes)
	salt: string; // base64-encoded salt for key derivation (16 bytes)
}

export class EncryptionService {
	private readonly masterKeyBuffer: Uint8Array;

	constructor(masterKeyBase64: string) {
		if (!masterKeyBase64 || masterKeyBase64.trim().length === 0) {
			throw new Error("Encryption master key is required");
		}

		try {
			// Decode base64 master key
			this.masterKeyBuffer = Uint8Array.from(atob(masterKeyBase64), (c) =>
				c.charCodeAt(0),
			);

			if (this.masterKeyBuffer.length < 32) {
				throw new Error(
					"Encryption master key must be at least 32 bytes (256 bits)",
				);
			}
		} catch (error) {
			throw new Error(
				`Invalid encryption master key format: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Encrypts an API key using AES-256-GCM
	 * @param plaintext The API key to encrypt
	 * @param discordUserId Discord user ID (used as additional authenticated data)
	 * @returns Encrypted data with IV and salt
	 */
	async encryptApiKey(
		plaintext: string,
		discordUserId: string,
	): Promise<EncryptedData> {
		try {
			// Generate unique salt and IV for this encryption
			const salt = this.generateSalt();
			const iv = this.generateIV();

			// Derive encryption key from master key and salt
			const key = await this.deriveKey(salt);

			// Convert plaintext and additional data to Uint8Array
			const plaintextBuffer = new TextEncoder().encode(plaintext);
			const additionalData = new TextEncoder().encode(discordUserId);

			// Encrypt using AES-256-GCM
			const ciphertextBuffer = await crypto.subtle.encrypt(
				{
					name: "AES-GCM",
					iv: iv,
					additionalData: additionalData,
					tagLength: 128, // 128-bit authentication tag
				},
				key,
				plaintextBuffer,
			);

			// Convert to base64 for storage
			return {
				ciphertext: this.arrayBufferToBase64(ciphertextBuffer),
				iv: this.arrayBufferToBase64(iv),
				salt: this.arrayBufferToBase64(salt),
			};
		} catch (error) {
			throw new Error(
				`Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Decrypts an API key using AES-256-GCM
	 * @param encrypted The encrypted data (ciphertext, IV, salt)
	 * @param discordUserId Discord user ID (must match the one used during encryption)
	 * @returns Decrypted API key
	 */
	async decryptApiKey(
		encrypted: EncryptedData,
		discordUserId: string,
	): Promise<string> {
		try {
			// Convert base64 back to Uint8Array
			const ciphertextBuffer = this.base64ToArrayBuffer(encrypted.ciphertext);
			const iv = this.base64ToArrayBuffer(encrypted.iv);
			const salt = this.base64ToArrayBuffer(encrypted.salt);

			// Derive the same encryption key using stored salt
			const key = await this.deriveKey(new Uint8Array(salt));

			// Convert additional data
			const additionalData = new TextEncoder().encode(discordUserId);

			// Decrypt using AES-256-GCM
			const plaintextBuffer = await crypto.subtle.decrypt(
				{
					name: "AES-GCM",
					iv: new Uint8Array(iv),
					additionalData: additionalData,
					tagLength: 128,
				},
				key,
				ciphertextBuffer,
			);

			// Convert back to string
			return new TextDecoder().decode(plaintextBuffer);
		} catch (error) {
			// Don't leak crypto details in error message
			throw new Error(
				"Decryption failed. The data may be corrupted or the user ID may not match.",
			);
		}
	}

	/**
	 * Derives an AES-256-GCM key from the master key using PBKDF2
	 * @param salt Unique salt for this derivation
	 * @returns CryptoKey suitable for AES-GCM
	 */
	private async deriveKey(salt: Uint8Array): Promise<CryptoKey> {
		// Import master key for use with PBKDF2
		const masterKey = await crypto.subtle.importKey(
			"raw",
			this.masterKeyBuffer,
			{ name: "PBKDF2" },
			false,
			["deriveKey"],
		);

		// Derive AES-256-GCM key using PBKDF2
		return await crypto.subtle.deriveKey(
			{
				name: "PBKDF2",
				salt: salt,
				iterations: 100000, // 100k iterations for security
				hash: "SHA-256",
			},
			masterKey,
			{
				name: "AES-GCM",
				length: 256, // 256-bit key
			},
			false,
			["encrypt", "decrypt"],
		);
	}

	/**
	 * Generates a cryptographically secure random salt (16 bytes)
	 */
	private generateSalt(): Uint8Array {
		return crypto.getRandomValues(new Uint8Array(16));
	}

	/**
	 * Generates a cryptographically secure random IV (12 bytes for AES-GCM)
	 */
	private generateIV(): Uint8Array {
		return crypto.getRandomValues(new Uint8Array(12));
	}

	/**
	 * Converts ArrayBuffer to base64 string
	 */
	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	/**
	 * Converts base64 string to ArrayBuffer
	 */
	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes.buffer;
	}
}
