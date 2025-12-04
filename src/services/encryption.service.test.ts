// Tests for EncryptionService

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EncryptionService, type EncryptedData } from "./encryption.service";

// Mock crypto API
const mockGetRandomValues = vi.fn();
const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();
const mockImportKey = vi.fn();
const mockDeriveKey = vi.fn();

// Create a valid 32-byte base64 master key for testing
const createValidMasterKey = (): string => {
	const bytes = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		bytes[i] = i;
	}
	return btoa(String.fromCharCode(...bytes));
};

describe("EncryptionService", () => {
	describe("Constructor", () => {
		it("should create service with valid master key", () => {
			const masterKey = createValidMasterKey();
			const service = new EncryptionService(masterKey);
			expect(service).toBeInstanceOf(EncryptionService);
		});

		it("should throw error for empty master key", () => {
			expect(() => new EncryptionService("")).toThrow(
				"Encryption master key is required",
			);
			expect(() => new EncryptionService("   ")).toThrow(
				"Encryption master key is required",
			);
		});

		it("should throw error for invalid base64 master key", () => {
			expect(() => new EncryptionService("invalid-base64!@#")).toThrow(
				"Invalid encryption master key format",
			);
		});

		it("should throw error for master key shorter than 32 bytes", () => {
			const shortKey = btoa("short");
			expect(() => new EncryptionService(shortKey)).toThrow(
				"Encryption master key must be at least 32 bytes",
			);
		});

		it("should accept master key exactly 32 bytes", () => {
			const masterKey = createValidMasterKey();
			const service = new EncryptionService(masterKey);
			expect(service).toBeInstanceOf(EncryptionService);
		});

		it("should accept master key longer than 32 bytes", () => {
			const longKey = btoa("a".repeat(64));
			const service = new EncryptionService(longKey);
			expect(service).toBeInstanceOf(EncryptionService);
		});
	});

	describe("encryptApiKey", () => {
		let service: EncryptionService;
		const masterKey = createValidMasterKey();
		const testApiKey = "test-api-key-12345";
		const testUserId = "discord_user_123";

		beforeEach(() => {
			service = new EncryptionService(masterKey);
			// Reset mocks
			vi.clearAllMocks();
		});

		it("should encrypt API key successfully", async () => {
			const encrypted = await service.encryptApiKey(testApiKey, testUserId);

			expect(encrypted).toHaveProperty("ciphertext");
			expect(encrypted).toHaveProperty("iv");
			expect(encrypted).toHaveProperty("salt");
			expect(typeof encrypted.ciphertext).toBe("string");
			expect(typeof encrypted.iv).toBe("string");
			expect(typeof encrypted.salt).toBe("string");
			expect(encrypted.ciphertext.length).toBeGreaterThan(0);
			expect(encrypted.iv.length).toBeGreaterThan(0);
			expect(encrypted.salt.length).toBeGreaterThan(0);
		});

		it("should produce different ciphertext for same input (unique IV/salt)", async () => {
			const encrypted1 = await service.encryptApiKey(testApiKey, testUserId);
			const encrypted2 = await service.encryptApiKey(testApiKey, testUserId);

			// Ciphertext should be different due to unique IV and salt
			expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
			expect(encrypted1.iv).not.toBe(encrypted2.iv);
			expect(encrypted1.salt).not.toBe(encrypted2.salt);
		});

		it("should encrypt different API keys", async () => {
			const encrypted1 = await service.encryptApiKey("key1", testUserId);
			const encrypted2 = await service.encryptApiKey("key2", testUserId);

			expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
		});

		it("should encrypt with different user IDs", async () => {
			const encrypted1 = await service.encryptApiKey(testApiKey, "user1");
			const encrypted2 = await service.encryptApiKey(testApiKey, "user2");

			// Should produce different ciphertext due to different AAD
			expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
		});

		it("should handle empty API key", async () => {
			const encrypted = await service.encryptApiKey("", testUserId);
			expect(encrypted).toHaveProperty("ciphertext");
		});

		it("should handle very long API key", async () => {
			const longKey = "a".repeat(1000);
			const encrypted = await service.encryptApiKey(longKey, testUserId);
			expect(encrypted).toHaveProperty("ciphertext");
		});

		it("should handle special characters in API key", async () => {
			const specialKey = "key-with-special-chars!@#$%^&*()_+-=[]{}|;':\",./<>?";
			const encrypted = await service.encryptApiKey(specialKey, testUserId);
			expect(encrypted).toHaveProperty("ciphertext");
		});
	});

	describe("decryptApiKey", () => {
		let service: EncryptionService;
		const masterKey = createValidMasterKey();
		const testApiKey = "test-api-key-12345";
		const testUserId = "discord_user_123";

		beforeEach(() => {
			service = new EncryptionService(masterKey);
		});

		it("should decrypt API key successfully", async () => {
			const encrypted = await service.encryptApiKey(testApiKey, testUserId);
			const decrypted = await service.decryptApiKey(encrypted, testUserId);

			expect(decrypted).toBe(testApiKey);
		});

		it("should decrypt multiple times correctly", async () => {
			const encrypted = await service.encryptApiKey(testApiKey, testUserId);

			const decrypted1 = await service.decryptApiKey(encrypted, testUserId);
			const decrypted2 = await service.decryptApiKey(encrypted, testUserId);

			expect(decrypted1).toBe(testApiKey);
			expect(decrypted2).toBe(testApiKey);
		});

		it("should fail decryption with wrong user ID", async () => {
			const encrypted = await service.encryptApiKey(testApiKey, testUserId);

			await expect(
				service.decryptApiKey(encrypted, "wrong_user_id"),
			).rejects.toThrow("Decryption failed");
		});

		it("should fail decryption with corrupted ciphertext", async () => {
			const encrypted = await service.encryptApiKey(testApiKey, testUserId);
			const corrupted: EncryptedData = {
				...encrypted,
				ciphertext: "corrupted_base64_data",
			};

			await expect(
				service.decryptApiKey(corrupted, testUserId),
			).rejects.toThrow("Decryption failed");
		});

		it("should fail decryption with corrupted IV", async () => {
			const encrypted = await service.encryptApiKey(testApiKey, testUserId);
			const corrupted: EncryptedData = {
				...encrypted,
				iv: "corrupted_iv",
			};

			await expect(
				service.decryptApiKey(corrupted, testUserId),
			).rejects.toThrow("Decryption failed");
		});

		it("should fail decryption with corrupted salt", async () => {
			const encrypted = await service.encryptApiKey(testApiKey, testUserId);
			const corrupted: EncryptedData = {
				...encrypted,
				salt: "corrupted_salt",
			};

			await expect(
				service.decryptApiKey(corrupted, testUserId),
			).rejects.toThrow("Decryption failed");
		});

		it("should decrypt empty API key", async () => {
			const encrypted = await service.encryptApiKey("", testUserId);
			const decrypted = await service.decryptApiKey(encrypted, testUserId);
			expect(decrypted).toBe("");
		});

		it("should decrypt very long API key", async () => {
			const longKey = "a".repeat(1000);
			const encrypted = await service.encryptApiKey(longKey, testUserId);
			const decrypted = await service.decryptApiKey(encrypted, testUserId);
			expect(decrypted).toBe(longKey);
		});

		it("should decrypt special characters correctly", async () => {
			const specialKey = "key-with-special-chars!@#$%^&*()_+-=[]{}|;':\",./<>?";
			const encrypted = await service.encryptApiKey(specialKey, testUserId);
			const decrypted = await service.decryptApiKey(encrypted, testUserId);
			expect(decrypted).toBe(specialKey);
		});
	});

	describe("Round-trip encryption/decryption", () => {
		let service: EncryptionService;
		const masterKey = createValidMasterKey();

		beforeEach(() => {
			service = new EncryptionService(masterKey);
		});

		it("should encrypt and decrypt various API key formats", async () => {
			const testCases = [
				"simple-key",
				"key-with-dashes-123",
				"key_with_underscores_456",
				"key.with.dots.789",
				"UPPERCASE-KEY",
				"mixedCaseKey123",
				"1234567890",
				"key-with-unicode-测试",
			];

			for (const apiKey of testCases) {
				const encrypted = await service.encryptApiKey(apiKey, "user123");
				const decrypted = await service.decryptApiKey(encrypted, "user123");
				expect(decrypted).toBe(apiKey);
			}
		});

		it("should maintain data integrity across multiple encryptions", async () => {
			const apiKey = "test-api-key";
			const userId = "user123";

			// Encrypt multiple times
			const encrypted1 = await service.encryptApiKey(apiKey, userId);
			const encrypted2 = await service.encryptApiKey(apiKey, userId);
			const encrypted3 = await service.encryptApiKey(apiKey, userId);

			// All should decrypt to the same value
			expect(await service.decryptApiKey(encrypted1, userId)).toBe(apiKey);
			expect(await service.decryptApiKey(encrypted2, userId)).toBe(apiKey);
			expect(await service.decryptApiKey(encrypted3, userId)).toBe(apiKey);
		});
	});

	describe("Security properties", () => {
		let service: EncryptionService;
		const masterKey = createValidMasterKey();

		beforeEach(() => {
			service = new EncryptionService(masterKey);
		});

		it("should use unique IV for each encryption", async () => {
			const apiKey = "test-key";
			const userId = "user123";

			const encrypted1 = await service.encryptApiKey(apiKey, userId);
			const encrypted2 = await service.encryptApiKey(apiKey, userId);
			const encrypted3 = await service.encryptApiKey(apiKey, userId);

			const ivs = [encrypted1.iv, encrypted2.iv, encrypted3.iv];
			const uniqueIvs = new Set(ivs);

			// All IVs should be unique
			expect(uniqueIvs.size).toBe(3);
		});

		it("should use unique salt for each encryption", async () => {
			const apiKey = "test-key";
			const userId = "user123";

			const encrypted1 = await service.encryptApiKey(apiKey, userId);
			const encrypted2 = await service.encryptApiKey(apiKey, userId);
			const encrypted3 = await service.encryptApiKey(apiKey, userId);

			const salts = [encrypted1.salt, encrypted2.salt, encrypted3.salt];
			const uniqueSalts = new Set(salts);

			// All salts should be unique
			expect(uniqueSalts.size).toBe(3);
		});

		it("should prevent tampering with different user ID", async () => {
			const apiKey = "test-key";
			const userId1 = "user1";
			const userId2 = "user2";

			const encrypted = await service.encryptApiKey(apiKey, userId1);

			// Should fail to decrypt with different user ID
			await expect(
				service.decryptApiKey(encrypted, userId2),
			).rejects.toThrow("Decryption failed");
		});
	});
});



