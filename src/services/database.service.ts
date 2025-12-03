/**
 * DatabaseService
 *
 * Handles all Cloudflare D1 database operations for user authentication.
 * Uses prepared statements to prevent SQL injection.
 */

import type { EncryptedData } from "./encryption.service";
import { logger } from "../utils/logger";

export interface UserApiKeyRecord {
	discordUserId: string;
	encryptedApiKey: string;
	encryptionIv: string;
	encryptionSalt: string;
	registrationTimestamp: number;
	lastUsedTimestamp: number;
	lastValidatedTimestamp: number | null;
	validationStatus: "pending" | "valid" | "invalid";
	temboUserId: string | null;
	temboOrgId: string | null;
	temboEmail: string | null;
}

export interface AuthEvent {
	discordUserId: string;
	eventType:
		| "register"
		| "update"
		| "unregister"
		| "validation_success"
		| "validation_failure"
		| "auth_failure";
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export interface UserStatusInfo {
	registered: boolean;
	discordUserId?: string;
	registrationTimestamp?: number;
	lastUsedTimestamp?: number;
	lastValidatedTimestamp?: number | null;
	validationStatus?: "pending" | "valid" | "invalid";
	temboUserId?: string | null;
	temboOrgId?: string | null;
	temboEmail?: string | null;
}

export class DatabaseService {
	constructor(private readonly db: D1Database) {
		if (!db) {
			throw new Error("D1 database binding is required");
		}
	}

	/**
	 * Retrieves a user's API key record from the database
	 * @param discordUserId Discord user ID
	 * @returns User API key record or null if not found
	 */
	async getUserApiKey(
		discordUserId: string,
	): Promise<UserApiKeyRecord | null> {
		try {
			const stmt = this.db.prepare(
				"SELECT * FROM user_api_keys WHERE discord_user_id = ?",
			);
			const result = await stmt.bind(discordUserId).first<{
				discord_user_id: string;
				encrypted_api_key: string;
				encryption_iv: string;
				encryption_salt: string;
				registration_timestamp: number;
				last_used_timestamp: number;
				last_validated_timestamp: number | null;
				validation_status: "pending" | "valid" | "invalid";
				tembo_user_id: string | null;
				tembo_org_id: string | null;
				tembo_email: string | null;
			}>();

			if (!result) {
				return null;
			}

			// Map snake_case to camelCase
			return {
				discordUserId: result.discord_user_id,
				encryptedApiKey: result.encrypted_api_key,
				encryptionIv: result.encryption_iv,
				encryptionSalt: result.encryption_salt,
				registrationTimestamp: result.registration_timestamp,
				lastUsedTimestamp: result.last_used_timestamp,
				lastValidatedTimestamp: result.last_validated_timestamp,
				validationStatus: result.validation_status,
				temboUserId: result.tembo_user_id,
				temboOrgId: result.tembo_org_id,
				temboEmail: result.tembo_email,
			};
		} catch (error) {
			logger.error("Failed to get user API key", error, { discordUserId });
			throw new Error("Database query failed");
		}
	}

	/**
	 * Saves a new user API key record to the database
	 * @param record User API key record to save
	 */
	async saveUserApiKey(
		record: Omit<UserApiKeyRecord, "registrationTimestamp" | "lastUsedTimestamp">,
	): Promise<void> {
		try {
			const now = Date.now();
			const stmt = this.db.prepare(`
				INSERT INTO user_api_keys (
					discord_user_id,
					encrypted_api_key,
					encryption_iv,
					encryption_salt,
					registration_timestamp,
					last_used_timestamp,
					last_validated_timestamp,
					validation_status,
					tembo_user_id,
					tembo_org_id,
					tembo_email
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);

			await stmt
				.bind(
					record.discordUserId,
					record.encryptedApiKey,
					record.encryptionIv,
					record.encryptionSalt,
					now,
					now,
					record.lastValidatedTimestamp ?? null,
					record.validationStatus,
					record.temboUserId ?? null,
					record.temboOrgId ?? null,
					record.temboEmail ?? null,
				)
				.run();

			logger.info("User API key saved", { discordUserId: record.discordUserId });
		} catch (error) {
			logger.error("Failed to save user API key", error, {
				discordUserId: record.discordUserId,
			});
			throw new Error("Failed to save user API key");
		}
	}

	/**
	 * Updates an existing user's API key
	 * @param discordUserId Discord user ID
	 * @param encrypted New encrypted API key data
	 */
	async updateUserApiKey(
		discordUserId: string,
		encrypted: EncryptedData,
	): Promise<void> {
		try {
			const now = Date.now();
			const stmt = this.db.prepare(`
				UPDATE user_api_keys
				SET encrypted_api_key = ?,
				    encryption_iv = ?,
				    encryption_salt = ?,
				    last_used_timestamp = ?,
				    last_validated_timestamp = ?,
				    validation_status = 'pending'
				WHERE discord_user_id = ?
			`);

			await stmt
				.bind(
					encrypted.ciphertext,
					encrypted.iv,
					encrypted.salt,
					now,
					now,
					discordUserId,
				)
				.run();

			logger.info("User API key updated", { discordUserId });
		} catch (error) {
			logger.error("Failed to update user API key", error, { discordUserId });
			throw new Error("Failed to update user API key");
		}
	}

	/**
	 * Deletes a user's API key from the database
	 * @param discordUserId Discord user ID
	 */
	async deleteUserApiKey(discordUserId: string): Promise<void> {
		try {
			const stmt = this.db.prepare(
				"DELETE FROM user_api_keys WHERE discord_user_id = ?",
			);
			await stmt.bind(discordUserId).run();

			logger.info("User API key deleted", { discordUserId });
		} catch (error) {
			logger.error("Failed to delete user API key", error, { discordUserId });
			throw new Error("Failed to delete user API key");
		}
	}

	/**
	 * Updates the last used timestamp for a user
	 * @param discordUserId Discord user ID
	 */
	async updateLastUsed(discordUserId: string): Promise<void> {
		try {
			const now = Date.now();
			const stmt = this.db.prepare(
				"UPDATE user_api_keys SET last_used_timestamp = ? WHERE discord_user_id = ?",
			);
			await stmt.bind(now, discordUserId).run();
		} catch (error) {
			// Don't throw on failure - this is non-critical
			logger.warn("Failed to update last used timestamp", {
				discordUserId,
				error,
			});
		}
	}

	/**
	 * Updates validation status and user info after API key validation
	 * @param discordUserId Discord user ID
	 * @param status Validation status
	 * @param userInfo Optional Tembo user info from /me endpoint
	 */
	async updateValidationStatus(
		discordUserId: string,
		status: "pending" | "valid" | "invalid",
		userInfo?: {
			userId?: string;
			orgId?: string;
			email?: string;
		},
	): Promise<void> {
		try {
			const now = Date.now();
			const stmt = this.db.prepare(`
				UPDATE user_api_keys
				SET validation_status = ?,
				    last_validated_timestamp = ?,
				    tembo_user_id = ?,
				    tembo_org_id = ?,
				    tembo_email = ?
				WHERE discord_user_id = ?
			`);

			await stmt
				.bind(
					status,
					now,
					userInfo?.userId ?? null,
					userInfo?.orgId ?? null,
					userInfo?.email ?? null,
					discordUserId,
				)
				.run();

			logger.info("Validation status updated", { discordUserId, status });
		} catch (error) {
			logger.error("Failed to update validation status", error, {
				discordUserId,
			});
			throw new Error("Failed to update validation status");
		}
	}

	/**
	 * Logs an authentication event to the audit table
	 * @param event Authentication event details
	 */
	async logAuthEvent(event: AuthEvent): Promise<void> {
		try {
			const stmt = this.db.prepare(`
				INSERT INTO auth_events (
					discord_user_id,
					event_type,
					timestamp,
					metadata
				) VALUES (?, ?, ?, ?)
			`);

			await stmt
				.bind(
					event.discordUserId,
					event.eventType,
					event.timestamp,
					event.metadata ? JSON.stringify(event.metadata) : null,
				)
				.run();

			logger.info("Auth event logged", {
				discordUserId: event.discordUserId,
				eventType: event.eventType,
			});
		} catch (error) {
			// Don't throw on audit log failure - log and continue
			logger.error("Failed to log auth event", error, {
				discordUserId: event.discordUserId,
				eventType: event.eventType,
			});
		}
	}

	/**
	 * Gets user registration status for /status command
	 * @param discordUserId Discord user ID
	 * @returns User status information
	 */
	async getUserStatus(discordUserId: string): Promise<UserStatusInfo> {
		const record = await this.getUserApiKey(discordUserId);

		if (!record) {
			return { registered: false };
		}

		return {
			registered: true,
			discordUserId: record.discordUserId,
			registrationTimestamp: record.registrationTimestamp,
			lastUsedTimestamp: record.lastUsedTimestamp,
			lastValidatedTimestamp: record.lastValidatedTimestamp,
			validationStatus: record.validationStatus,
			temboUserId: record.temboUserId,
			temboOrgId: record.temboOrgId,
			temboEmail: record.temboEmail,
		};
	}

	/**
	 * Gets total number of registered users (for admin stats)
	 * @returns Count of registered users
	 */
	async getUserCount(): Promise<number> {
		try {
			const stmt = this.db.prepare("SELECT COUNT(*) as count FROM user_api_keys");
			const result = await stmt.first<{ count: number }>();
			return result?.count ?? 0;
		} catch (error) {
			logger.error("Failed to get user count", error);
			return 0;
		}
	}
}
