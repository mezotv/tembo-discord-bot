// Tests for AuthService

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AuthService } from "./auth.service";
import { DatabaseService } from "./database.service";
import { EncryptionService } from "./encryption.service";
import * as temboServiceModule from "./tembo.service";
import { AuthenticationError } from "../utils/errors";
import type { TemboUserInfo } from "../types";

describe("AuthService", () => {
	let authService: AuthService;
	let mockDbService: any;
	let mockEncryptionService: any;
	let mockTemboService: any;

	beforeEach(() => {
		// Create mocks
		mockDbService = {
			getUserApiKey: vi.fn(),
			saveUserApiKey: vi.fn(),
			updateUserApiKey: vi.fn(),
			updateValidationStatus: vi.fn(),
			updateLastUsed: vi.fn(),
			deleteUserApiKey: vi.fn(),
			logAuthEvent: vi.fn(),
			getUserStatus: vi.fn(),
		};

		mockEncryptionService = {
			encryptApiKey: vi.fn(),
			decryptApiKey: vi.fn(),
		};

		mockTemboService = {
			getCurrentUser: vi.fn(),
		};

		authService = new AuthService(
			mockDbService as unknown as DatabaseService,
			mockEncryptionService as unknown as EncryptionService,
		);

		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("authenticateUser", () => {
		const discordUserId = "user123";
		const encryptedData = {
			ciphertext: "encrypted_key",
			iv: "iv123",
			salt: "salt123",
		};
		const decryptedApiKey = "decrypted_api_key_123";
		const mockUserRecord = {
			discordUserId: "user123",
			encryptedApiKey: "encrypted_key",
			encryptionIv: "iv123",
			encryptionSalt: "salt123",
			registrationTimestamp: 1000000,
			lastUsedTimestamp: 2000000,
			lastValidatedTimestamp: 1500000,
			validationStatus: "valid" as const,
			temboUserId: "tembo_user_123",
			temboOrgId: "tembo_org_456",
			temboEmail: "user@example.com",
		};

		it("should authenticate user successfully", async () => {
			mockDbService.getUserApiKey.mockResolvedValue(mockUserRecord);
			mockEncryptionService.decryptApiKey.mockResolvedValue(decryptedApiKey);
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockTemboService as unknown as temboServiceModule.TemboService,
			);
			mockTemboService.getCurrentUser.mockResolvedValue({
				userId: "tembo_user_123",
				orgId: "tembo_org_456",
			});

			const result = await authService.authenticateUser(discordUserId);

			expect(result.success).toBe(true);
			expect(result.temboService).toBeDefined();
			expect(result.requiresOnboarding).toBe(false);
			expect(mockDbService.updateLastUsed).toHaveBeenCalledWith(discordUserId);
		});

		it("should return onboarding flag for unregistered user", async () => {
			mockDbService.getUserApiKey.mockResolvedValue(null);

			const result = await authService.authenticateUser(discordUserId);

			expect(result.success).toBe(false);
			expect(result.requiresOnboarding).toBe(true);
			expect(result.temboService).toBeUndefined();
		});

		it("should handle decryption failure", async () => {
			mockDbService.getUserApiKey.mockResolvedValue(mockUserRecord);
			mockEncryptionService.decryptApiKey.mockRejectedValue(
				new Error("Decryption failed"),
			);

			const result = await authService.authenticateUser(discordUserId);

			expect(result.success).toBe(false);
			expect(result.requiresOnboarding).toBe(false);
			expect(result.error).toContain("decrypt");
			expect(mockDbService.logAuthEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					discordUserId,
					eventType: "auth_failure",
					metadata: { reason: "decryption_failed" },
				}),
			);
		});

		it("should handle TemboService creation failure", async () => {
			mockDbService.getUserApiKey.mockResolvedValue(mockUserRecord);
			mockEncryptionService.decryptApiKey.mockResolvedValue(decryptedApiKey);
			vi.spyOn(temboServiceModule, "createTemboService").mockImplementation(() => {
				throw new Error("Invalid API key");
			});

			const result = await authService.authenticateUser(discordUserId);

			expect(result.success).toBe(false);
			expect(result.requiresOnboarding).toBe(false);
			expect(result.error).toContain("initialize Tembo service");
		});

		it("should handle invalid API key", async () => {
			mockDbService.getUserApiKey.mockResolvedValue(mockUserRecord);
			mockEncryptionService.decryptApiKey.mockResolvedValue(decryptedApiKey);
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockTemboService as unknown as temboServiceModule.TemboService,
			);
			mockTemboService.getCurrentUser.mockRejectedValue(
				new AuthenticationError("/me"),
			);

			const result = await authService.authenticateUser(discordUserId);

			expect(result.success).toBe(false);
			expect(result.requiresOnboarding).toBe(false);
			expect(result.error).toContain("invalid or expired");
			expect(mockDbService.updateValidationStatus).toHaveBeenCalledWith(
				discordUserId,
				"invalid",
			);
			expect(mockDbService.logAuthEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					discordUserId,
					eventType: "auth_failure",
					metadata: { reason: "invalid_api_key" },
				}),
			);
		});

		it("should handle network/service errors", async () => {
			mockDbService.getUserApiKey.mockResolvedValue(mockUserRecord);
			mockEncryptionService.decryptApiKey.mockResolvedValue(decryptedApiKey);
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockTemboService as unknown as temboServiceModule.TemboService,
			);
			mockTemboService.getCurrentUser.mockRejectedValue(
				new Error("Network error"),
			);

			const result = await authService.authenticateUser(discordUserId);

			expect(result.success).toBe(false);
			expect(result.requiresOnboarding).toBe(false);
			expect(result.error).toContain("validate your API key");
		});

		it("should handle unexpected errors", async () => {
			mockDbService.getUserApiKey.mockRejectedValue(
				new Error("Unexpected error"),
			);

			const result = await authService.authenticateUser(discordUserId);

			expect(result.success).toBe(false);
			expect(result.requiresOnboarding).toBe(false);
			expect(result.error).toContain("unexpected error");
		});
	});

	describe("registerApiKey", () => {
		const discordUserId = "user123";
		const apiKey = "test_api_key_123";
		const userInfo: TemboUserInfo = {
			userId: "tembo_user_123",
			orgId: "tembo_org_456",
			email: "user@example.com",
		};
		const encryptedData = {
			ciphertext: "encrypted_key",
			iv: "iv123",
			salt: "salt123",
		};

		it("should register new API key successfully", async () => {
			mockEncryptionService.encryptApiKey.mockResolvedValue(encryptedData);
			mockDbService.getUserApiKey.mockResolvedValue(null);
			mockDbService.saveUserApiKey.mockResolvedValue(undefined);
			mockDbService.updateValidationStatus.mockResolvedValue(undefined);
			mockDbService.logAuthEvent.mockResolvedValue(undefined);

			// Mock validateApiKey by mocking TemboService
			const mockValidationTemboService = {
				getCurrentUser: vi.fn().mockResolvedValue(userInfo),
			};
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockValidationTemboService as unknown as temboServiceModule.TemboService,
			);

			const result = await authService.registerApiKey(discordUserId, apiKey);

			expect(result.success).toBe(true);
			expect(result.userInfo).toEqual(userInfo);
			expect(mockDbService.saveUserApiKey).toHaveBeenCalled();
			expect(mockDbService.logAuthEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					discordUserId,
					eventType: "register",
				}),
			);
		});

		it("should update existing API key successfully", async () => {
			const existingUser = {
				discordUserId: "user123",
				encryptedApiKey: "old_encrypted_key",
				encryptionIv: "old_iv",
				encryptionSalt: "old_salt",
				registrationTimestamp: 1000000,
				lastUsedTimestamp: 2000000,
				lastValidatedTimestamp: 1500000,
				validationStatus: "valid" as const,
				temboUserId: "old_tembo_user",
				temboOrgId: "old_tembo_org",
				temboEmail: "old@example.com",
			};

			mockEncryptionService.encryptApiKey.mockResolvedValue(encryptedData);
			mockDbService.getUserApiKey.mockResolvedValue(existingUser);
			mockDbService.updateUserApiKey.mockResolvedValue(undefined);
			mockDbService.updateValidationStatus.mockResolvedValue(undefined);
			mockDbService.logAuthEvent.mockResolvedValue(undefined);

			// Mock validateApiKey
			const mockValidationTemboService = {
				getCurrentUser: vi.fn().mockResolvedValue(userInfo),
			};
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockValidationTemboService as unknown as temboServiceModule.TemboService,
			);

			const result = await authService.registerApiKey(discordUserId, apiKey);

			expect(result.success).toBe(true);
			expect(result.userInfo).toEqual(userInfo);
			expect(mockDbService.updateUserApiKey).toHaveBeenCalledWith(
				discordUserId,
				encryptedData,
			);
			expect(mockDbService.logAuthEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					discordUserId,
					eventType: "update",
				}),
			);
		});

		it("should reject invalid API key", async () => {
			const mockValidationTemboService = {
				getCurrentUser: vi.fn().mockRejectedValue(new AuthenticationError("/me")),
			};
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockValidationTemboService as unknown as temboServiceModule.TemboService,
			);

			const result = await authService.registerApiKey(discordUserId, apiKey);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Invalid API key");
			expect(mockDbService.saveUserApiKey).not.toHaveBeenCalled();
		});

		it("should handle encryption failure", async () => {
			const mockValidationTemboService = {
				getCurrentUser: vi.fn().mockResolvedValue(userInfo),
			};
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockValidationTemboService as unknown as temboServiceModule.TemboService,
			);
			mockEncryptionService.encryptApiKey.mockRejectedValue(
				new Error("Encryption failed"),
			);

			const result = await authService.registerApiKey(discordUserId, apiKey);

			expect(result.success).toBe(false);
			expect(result.error).toContain("encrypt");
		});

		it("should handle incomplete user info from validation", async () => {
			const incompleteUserInfo = {
				userId: "",
				orgId: "tembo_org_456",
			};

			const mockValidationTemboService = {
				getCurrentUser: vi.fn().mockResolvedValue(incompleteUserInfo),
			};
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockValidationTemboService as unknown as temboServiceModule.TemboService,
			);

			const result = await authService.registerApiKey(discordUserId, apiKey);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Invalid API key");
		});

		it("should handle unexpected errors", async () => {
			// Mock validateApiKey to succeed (it's called first)
			const mockValidationTemboService = {
				getCurrentUser: vi.fn().mockResolvedValue(userInfo),
			};
			vi.spyOn(temboServiceModule, "createTemboService").mockReturnValue(
				mockValidationTemboService as unknown as temboServiceModule.TemboService,
			);
			mockEncryptionService.encryptApiKey.mockResolvedValue(encryptedData);

			// Then mock getUserApiKey to throw (this happens after validation and encryption)
			mockDbService.getUserApiKey.mockRejectedValue(
				new Error("Unexpected error"),
			);

			const result = await authService.registerApiKey(discordUserId, apiKey);

			expect(result.success).toBe(false);
			expect(result.error).toContain("unexpected error");
		});
	});

	describe("unregisterUser", () => {
		const discordUserId = "user123";

		it("should unregister user successfully", async () => {
			mockDbService.deleteUserApiKey.mockResolvedValue(undefined);
			mockDbService.logAuthEvent.mockResolvedValue(undefined);

			await authService.unregisterUser(discordUserId);

			expect(mockDbService.deleteUserApiKey).toHaveBeenCalledWith(discordUserId);
			expect(mockDbService.logAuthEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					discordUserId,
					eventType: "unregister",
				}),
			);
		});

		it("should throw error on database failure", async () => {
			mockDbService.deleteUserApiKey.mockRejectedValue(
				new Error("Database error"),
			);

			await expect(authService.unregisterUser(discordUserId)).rejects.toThrow(
				"Failed to unregister user",
			);
		});
	});

	describe("isUserRegistered", () => {
		const discordUserId = "user123";

		it("should return true for registered user", async () => {
			mockDbService.getUserApiKey.mockResolvedValue({
				discordUserId: "user123",
				encryptedApiKey: "encrypted_key",
			});

			const result = await authService.isUserRegistered(discordUserId);

			expect(result).toBe(true);
		});

		it("should return false for unregistered user", async () => {
			mockDbService.getUserApiKey.mockResolvedValue(null);

			const result = await authService.isUserRegistered(discordUserId);

			expect(result).toBe(false);
		});
	});

	describe("getUserStatus", () => {
		const discordUserId = "user123";

		it("should return user status", async () => {
			const mockStatus = {
				registered: true,
				discordUserId: "user123",
				registrationTimestamp: 1000000,
				validationStatus: "valid" as const,
			};

			mockDbService.getUserStatus.mockResolvedValue(mockStatus);

			const result = await authService.getUserStatus(discordUserId);

			expect(result).toEqual(mockStatus);
			expect(mockDbService.getUserStatus).toHaveBeenCalledWith(discordUserId);
		});
	});
});

