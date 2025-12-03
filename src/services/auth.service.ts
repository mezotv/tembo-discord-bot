/**
 * AuthService
 *
 * Orchestrates user authentication, API key validation, and registration.
 * Coordinates between EncryptionService, DatabaseService, and TemboService.
 */

import { EncryptionService, type EncryptedData } from "./encryption.service";
import { DatabaseService, type UserStatusInfo } from "./database.service";
import { createTemboService, TemboService } from "./tembo.service";
import type { TemboUserInfo } from "../types";
import { logger } from "../utils/logger";
import { isAuthError } from "../utils/errors";

export interface AuthResult {
	success: boolean;
	temboService?: TemboService;
	requiresOnboarding: boolean;
	error?: string;
}

export interface RegisterResult {
	success: boolean;
	userInfo?: TemboUserInfo;
	error?: string;
}

export class AuthService {
	constructor(
		private readonly dbService: DatabaseService,
		private readonly encryptionService: EncryptionService,
	) {}

	/**
	 * Authenticates a Discord user and returns their TemboService instance
	 * @param discordUserId Discord user ID from interaction
	 * @returns AuthResult with TemboService if successful, or onboarding flag if not registered
	 */
	async authenticateUser(discordUserId: string): Promise<AuthResult> {
		try {
			// Check if user has an API key registered
			const record = await this.dbService.getUserApiKey(discordUserId);

			if (!record) {
				logger.info("User not registered", { discordUserId });
				return {
					success: false,
					requiresOnboarding: true,
				};
			}

			// Decrypt the API key
			const encrypted: EncryptedData = {
				ciphertext: record.encryptedApiKey,
				iv: record.encryptionIv,
				salt: record.encryptionSalt,
			};

			let decryptedApiKey: string;
			try {
				decryptedApiKey = await this.encryptionService.decryptApiKey(
					encrypted,
					discordUserId,
				);
			} catch (error) {
				logger.error("Failed to decrypt API key", error, { discordUserId });
				await this.dbService.logAuthEvent({
					discordUserId,
					eventType: "auth_failure",
					timestamp: Date.now(),
					metadata: { reason: "decryption_failed" },
				});
				return {
					success: false,
					requiresOnboarding: false,
					error:
						"Failed to decrypt your API key. Please re-register using /setup.",
				};
			}

			// Create TemboService with user's API key
			let temboService: TemboService;
			try {
				temboService = createTemboService(decryptedApiKey);
			} catch (error) {
				logger.error("Failed to create TemboService", error, { discordUserId });
				return {
					success: false,
					requiresOnboarding: false,
					error: "Failed to initialize Tembo service with your API key.",
				};
			}

			// Validate the API key still works by calling /me
			try {
				await temboService.getCurrentUser();

				// Update last used timestamp
				await this.dbService.updateLastUsed(discordUserId);

				logger.info("User authenticated successfully", { discordUserId });

				return {
					success: true,
					temboService,
					requiresOnboarding: false,
				};
			} catch (error) {
				// Check if it's an authentication error
				if (isAuthError(error)) {
					logger.warn("User API key is invalid", { discordUserId });

					// Mark key as invalid in database
					await this.dbService.updateValidationStatus(discordUserId, "invalid");
					await this.dbService.logAuthEvent({
						discordUserId,
						eventType: "auth_failure",
						timestamp: Date.now(),
						metadata: { reason: "invalid_api_key" },
					});

					return {
						success: false,
						requiresOnboarding: false,
						error:
							"Your API key is invalid or expired. Please update it using /setup.",
					};
				}

				// Other error - might be network/service issue
				logger.error("Failed to validate API key", error, { discordUserId });
				return {
					success: false,
					requiresOnboarding: false,
					error:
						"Failed to validate your API key. Please try again or use /setup to update it.",
				};
			}
		} catch (error) {
			logger.error("Authentication error", error, { discordUserId });
			return {
				success: false,
				requiresOnboarding: false,
				error: "An unexpected error occurred during authentication.",
			};
		}
	}

	/**
	 * Validates and registers a new API key for a user
	 * @param discordUserId Discord user ID
	 * @param apiKey Tembo API key to register
	 * @returns RegisterResult with user info if successful
	 */
	async registerApiKey(
		discordUserId: string,
		apiKey: string,
	): Promise<RegisterResult> {
		try {
			// Step 1: Validate the API key by calling Tembo /me endpoint
			const validation = await this.validateApiKey(apiKey);

			if (!validation.valid) {
				logger.warn("API key validation failed", { discordUserId });
				return {
					success: false,
					error:
						"Invalid API key. Please check your key and try again. Make sure you copied the entire key from the Tembo dashboard.",
				};
			}

			logger.info("API key validated successfully", {
				discordUserId,
				temboUserId: validation.userInfo?.userId,
			});

			// Step 2: Encrypt the API key
			let encrypted: EncryptedData;
			try {
				encrypted = await this.encryptionService.encryptApiKey(
					apiKey,
					discordUserId,
				);
			} catch (error) {
				logger.error("Failed to encrypt API key", error, { discordUserId });
				return {
					success: false,
					error:
						"Failed to encrypt your API key. Please try again or contact support.",
				};
			}

			// Step 3: Check if user already exists (update vs insert)
			const existingUser = await this.dbService.getUserApiKey(discordUserId);

			if (existingUser) {
				// Update existing user
				await this.dbService.updateUserApiKey(discordUserId, encrypted);
				await this.dbService.updateValidationStatus(
					discordUserId,
					"valid",
					validation.userInfo,
				);
				await this.dbService.logAuthEvent({
					discordUserId,
					eventType: "update",
					timestamp: Date.now(),
					metadata: { temboUserId: validation.userInfo?.userId },
				});

				logger.info("User API key updated", { discordUserId });
			} else {
				// Insert new user
				await this.dbService.saveUserApiKey({
					discordUserId,
					encryptedApiKey: encrypted.ciphertext,
					encryptionIv: encrypted.iv,
					encryptionSalt: encrypted.salt,
					lastValidatedTimestamp: Date.now(),
					validationStatus: "valid",
					temboUserId: validation.userInfo?.userId ?? null,
					temboOrgId: validation.userInfo?.orgId ?? null,
					temboEmail: validation.userInfo?.email ?? null,
				});
				await this.dbService.logAuthEvent({
					discordUserId,
					eventType: "register",
					timestamp: Date.now(),
					metadata: { temboUserId: validation.userInfo?.userId },
				});

				logger.info("New user registered", { discordUserId });
			}

			return {
				success: true,
				userInfo: validation.userInfo,
			};
		} catch (error) {
			logger.error("Failed to register API key", error, { discordUserId });
			return {
				success: false,
				error:
					"An unexpected error occurred while registering your API key. Please try again.",
			};
		}
	}

	/**
	 * Removes a user's API key from the database
	 * @param discordUserId Discord user ID
	 */
	async unregisterUser(discordUserId: string): Promise<void> {
		try {
			await this.dbService.deleteUserApiKey(discordUserId);
			await this.dbService.logAuthEvent({
				discordUserId,
				eventType: "unregister",
				timestamp: Date.now(),
			});

			logger.info("User unregistered", { discordUserId });
		} catch (error) {
			logger.error("Failed to unregister user", error, { discordUserId });
			throw new Error("Failed to unregister user. Please try again.");
		}
	}

	/**
	 * Checks if a user is registered
	 * @param discordUserId Discord user ID
	 * @returns True if user has a registered API key
	 */
	async isUserRegistered(discordUserId: string): Promise<boolean> {
		const record = await this.dbService.getUserApiKey(discordUserId);
		return record !== null;
	}

	/**
	 * Gets user registration status for /status command
	 * @param discordUserId Discord user ID
	 * @returns User status information
	 */
	async getUserStatus(discordUserId: string): Promise<UserStatusInfo> {
		return await this.dbService.getUserStatus(discordUserId);
	}

	/**
	 * Validates an API key by calling the Tembo /me endpoint
	 * @param apiKey Tembo API key to validate
	 * @returns Validation result with user info if successful
	 */
	private async validateApiKey(
		apiKey: string,
	): Promise<{ valid: boolean; userInfo?: TemboUserInfo }> {
		try {
			// Create a temporary TemboService to test the key
			const temboService = createTemboService(apiKey);

			// Call /me endpoint to verify the key works
			const userInfo = await temboService.getCurrentUser();

			// Additional validation: ensure we got required fields
			if (!userInfo.userId || !userInfo.orgId) {
				logger.warn("API key validation returned incomplete user info", {
					hasUserId: !!userInfo.userId,
					hasOrgId: !!userInfo.orgId,
				});
				return { valid: false };
			}

			logger.info("API key validation successful", {
				userId: userInfo.userId,
				orgId: userInfo.orgId,
			});

			return { valid: true, userInfo };
		} catch (error) {
			if (isAuthError(error)) {
				logger.warn("API key validation failed - invalid credentials");
				return { valid: false };
			}

			// Other errors (network, service unavailable, etc.)
			logger.error("API key validation error", error);
			return { valid: false };
		}
	}
}
