// Tests for DatabaseService

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DatabaseService } from "./database.service";
import type {
	UserApiKeyRecord,
	AuthEvent,
	UserStatusInfo,
} from "./database.service";
import type { EncryptedData } from "./encryption.service";

// Mock D1Database
const createMockD1Database = () => {
	const mockStmt = {
		bind: vi.fn().mockReturnThis(),
		first: vi.fn(),
		run: vi.fn(),
		all: vi.fn(),
	};

	const mockDb = {
		prepare: vi.fn(() => mockStmt),
	};

	return { mockDb, mockStmt };
};

describe("DatabaseService", () => {
	describe("Constructor", () => {
		it("should create service with valid database", () => {
			const { mockDb } = createMockD1Database();
			const service = new DatabaseService(mockDb as unknown as D1Database);
			expect(service).toBeInstanceOf(DatabaseService);
		});

		it("should throw error for null database", () => {
			expect(() => new DatabaseService(null as unknown as D1Database)).toThrow(
				"D1 database binding is required",
			);
		});

		it("should throw error for undefined database", () => {
			expect(
				() => new DatabaseService(undefined as unknown as D1Database),
			).toThrow("D1 database binding is required");
		});
	});

	describe("getUserApiKey", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
		});

		it("should retrieve user API key successfully", async () => {
			const mockRecord = {
				discord_user_id: "user123",
				encrypted_api_key: "encrypted_key",
				encryption_iv: "iv123",
				encryption_salt: "salt123",
				registration_timestamp: 1000000,
				last_used_timestamp: 2000000,
				last_validated_timestamp: 1500000,
				validation_status: "valid",
				tembo_user_id: "tembo_user_123",
				tembo_org_id: "tembo_org_456",
				tembo_email: "user@example.com",
			};

			mockStmt.first.mockResolvedValue(mockRecord);

			const result = await service.getUserApiKey("user123");

			expect(mockDb.prepare).toHaveBeenCalledWith(
				"SELECT * FROM user_api_keys WHERE discord_user_id = ?",
			);
			expect(mockStmt.bind).toHaveBeenCalledWith("user123");
			expect(result).toEqual({
				discordUserId: "user123",
				encryptedApiKey: "encrypted_key",
				encryptionIv: "iv123",
				encryptionSalt: "salt123",
				registrationTimestamp: 1000000,
				lastUsedTimestamp: 2000000,
				lastValidatedTimestamp: 1500000,
				validationStatus: "valid",
				temboUserId: "tembo_user_123",
				temboOrgId: "tembo_org_456",
				temboEmail: "user@example.com",
			});
		});

		it("should return null when user not found", async () => {
			mockStmt.first.mockResolvedValue(null);

			const result = await service.getUserApiKey("nonexistent");

			expect(result).toBeNull();
		});

		it("should handle null timestamps", async () => {
			const mockRecord = {
				discord_user_id: "user123",
				encrypted_api_key: "encrypted_key",
				encryption_iv: "iv123",
				encryption_salt: "salt123",
				registration_timestamp: 1000000,
				last_used_timestamp: 2000000,
				last_validated_timestamp: null,
				validation_status: "pending",
				tembo_user_id: null,
				tembo_org_id: null,
				tembo_email: null,
			};

			mockStmt.first.mockResolvedValue(mockRecord);

			const result = await service.getUserApiKey("user123");

			expect(result?.lastValidatedTimestamp).toBeNull();
			expect(result?.temboUserId).toBeNull();
			expect(result?.temboOrgId).toBeNull();
			expect(result?.temboEmail).toBeNull();
		});

		it("should throw error on database failure", async () => {
			mockStmt.first.mockRejectedValue(new Error("Database error"));

			await expect(service.getUserApiKey("user123")).rejects.toThrow(
				"Database query failed",
			);
		});
	});

	describe("saveUserApiKey", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
			vi.spyOn(Date, "now").mockReturnValue(1234567890);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should save new user API key successfully", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			const record = {
				discordUserId: "user123",
				encryptedApiKey: "encrypted_key",
				encryptionIv: "iv123",
				encryptionSalt: "salt123",
				lastValidatedTimestamp: 1000000,
				validationStatus: "valid" as const,
				temboUserId: "tembo_user_123",
				temboOrgId: "tembo_org_456",
				temboEmail: "user@example.com",
			};

			await service.saveUserApiKey(record);

			expect(mockDb.prepare).toHaveBeenCalled();
			expect(mockStmt.bind).toHaveBeenCalledWith(
				"user123",
				"encrypted_key",
				"iv123",
				"salt123",
				1234567890, // registration_timestamp
				1234567890, // last_used_timestamp
				1000000, // last_validated_timestamp
				"valid",
				"tembo_user_123",
				"tembo_org_456",
				"user@example.com",
			);
			expect(mockStmt.run).toHaveBeenCalled();
		});

		it("should handle null optional fields", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			const record = {
				discordUserId: "user123",
				encryptedApiKey: "encrypted_key",
				encryptionIv: "iv123",
				encryptionSalt: "salt123",
				lastValidatedTimestamp: null,
				validationStatus: "pending" as const,
				temboUserId: null,
				temboOrgId: null,
				temboEmail: null,
			};

			await service.saveUserApiKey(record);

			expect(mockStmt.bind).toHaveBeenCalledWith(
				"user123",
				"encrypted_key",
				"iv123",
				"salt123",
				1234567890,
				1234567890,
				null,
				"pending",
				null,
				null,
				null,
			);
		});

		it("should throw error on database failure", async () => {
			mockStmt.run.mockRejectedValue(new Error("Database error"));

			const record = {
				discordUserId: "user123",
				encryptedApiKey: "encrypted_key",
				encryptionIv: "iv123",
				encryptionSalt: "salt123",
				lastValidatedTimestamp: null,
				validationStatus: "valid" as const,
				temboUserId: null,
				temboOrgId: null,
				temboEmail: null,
			};

			await expect(service.saveUserApiKey(record)).rejects.toThrow(
				"Failed to save user API key",
			);
		});
	});

	describe("updateUserApiKey", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
			vi.spyOn(Date, "now").mockReturnValue(1234567890);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should update user API key successfully", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			const encrypted: EncryptedData = {
				ciphertext: "new_encrypted_key",
				iv: "new_iv",
				salt: "new_salt",
			};

			await service.updateUserApiKey("user123", encrypted);

			expect(mockDb.prepare).toHaveBeenCalled();
			expect(mockStmt.bind).toHaveBeenCalledWith(
				"new_encrypted_key",
				"new_iv",
				"new_salt",
				1234567890, // last_used_timestamp
				1234567890, // last_validated_timestamp
				"user123",
			);
			expect(mockStmt.run).toHaveBeenCalled();
		});

		it("should throw error on database failure", async () => {
			mockStmt.run.mockRejectedValue(new Error("Database error"));

			const encrypted: EncryptedData = {
				ciphertext: "encrypted_key",
				iv: "iv",
				salt: "salt",
			};

			await expect(
				service.updateUserApiKey("user123", encrypted),
			).rejects.toThrow("Failed to update user API key");
		});
	});

	describe("deleteUserApiKey", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
		});

		it("should delete user API key successfully", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			await service.deleteUserApiKey("user123");

			expect(mockDb.prepare).toHaveBeenCalledWith(
				"DELETE FROM user_api_keys WHERE discord_user_id = ?",
			);
			expect(mockStmt.bind).toHaveBeenCalledWith("user123");
			expect(mockStmt.run).toHaveBeenCalled();
		});

		it("should throw error on database failure", async () => {
			mockStmt.run.mockRejectedValue(new Error("Database error"));

			await expect(service.deleteUserApiKey("user123")).rejects.toThrow(
				"Failed to delete user API key",
			);
		});
	});

	describe("updateLastUsed", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
			vi.spyOn(Date, "now").mockReturnValue(1234567890);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should update last used timestamp successfully", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			await service.updateLastUsed("user123");

			expect(mockDb.prepare).toHaveBeenCalledWith(
				"UPDATE user_api_keys SET last_used_timestamp = ? WHERE discord_user_id = ?",
			);
			expect(mockStmt.bind).toHaveBeenCalledWith(1234567890, "user123");
			expect(mockStmt.run).toHaveBeenCalled();
		});

		it("should not throw on failure (non-critical operation)", async () => {
			mockStmt.run.mockRejectedValue(new Error("Database error"));

			// Should not throw - function catches errors internally
			await expect(service.updateLastUsed("user123")).resolves.toBeUndefined();
		});
	});

	describe("updateValidationStatus", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
			vi.spyOn(Date, "now").mockReturnValue(1234567890);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should update validation status successfully", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			await service.updateValidationStatus("user123", "valid", {
				userId: "tembo_user_123",
				orgId: "tembo_org_456",
				email: "user@example.com",
			});

			expect(mockStmt.bind).toHaveBeenCalledWith(
				"valid",
				1234567890,
				"tembo_user_123",
				"tembo_org_456",
				"user@example.com",
				"user123",
			);
		});

		it("should handle null user info", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			await service.updateValidationStatus("user123", "invalid");

			expect(mockStmt.bind).toHaveBeenCalledWith(
				"invalid",
				1234567890,
				null,
				null,
				null,
				"user123",
			);
		});

		it("should throw error on database failure", async () => {
			mockStmt.run.mockRejectedValue(new Error("Database error"));

			await expect(
				service.updateValidationStatus("user123", "valid"),
			).rejects.toThrow("Failed to update validation status");
		});
	});

	describe("logAuthEvent", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
		});

		it("should log auth event successfully", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			const event: AuthEvent = {
				discordUserId: "user123",
				eventType: "register",
				timestamp: 1234567890,
				metadata: { temboUserId: "tembo_user_123" },
			};

			await service.logAuthEvent(event);

			expect(mockStmt.bind).toHaveBeenCalledWith(
				"user123",
				"register",
				1234567890,
				JSON.stringify({ temboUserId: "tembo_user_123" }),
			);
		});

		it("should handle null metadata", async () => {
			mockStmt.run.mockResolvedValue({ success: true });

			const event: AuthEvent = {
				discordUserId: "user123",
				eventType: "unregister",
				timestamp: 1234567890,
			};

			await service.logAuthEvent(event);

			expect(mockStmt.bind).toHaveBeenCalledWith(
				"user123",
				"unregister",
				1234567890,
				null,
			);
		});

		it("should not throw on failure (non-critical operation)", async () => {
			mockStmt.run.mockRejectedValue(new Error("Database error"));

			const event: AuthEvent = {
				discordUserId: "user123",
				eventType: "register",
				timestamp: 1234567890,
			};

			// Should not throw - function catches errors internally
			await expect(service.logAuthEvent(event)).resolves.toBeUndefined();
		});
	});

	describe("getUserStatus", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
		});

		it("should return registered status for existing user", async () => {
			const mockRecord = {
				discord_user_id: "user123",
				encrypted_api_key: "encrypted_key",
				encryption_iv: "iv123",
				encryption_salt: "salt123",
				registration_timestamp: 1000000,
				last_used_timestamp: 2000000,
				last_validated_timestamp: 1500000,
				validation_status: "valid",
				tembo_user_id: "tembo_user_123",
				tembo_org_id: "tembo_org_456",
				tembo_email: "user@example.com",
			};

			mockStmt.first.mockResolvedValue(mockRecord);

			const status = await service.getUserStatus("user123");

			expect(status).toEqual({
				registered: true,
				discordUserId: "user123",
				registrationTimestamp: 1000000,
				lastUsedTimestamp: 2000000,
				lastValidatedTimestamp: 1500000,
				validationStatus: "valid",
				temboUserId: "tembo_user_123",
				temboOrgId: "tembo_org_456",
				temboEmail: "user@example.com",
			});
		});

		it("should return unregistered status for non-existent user", async () => {
			mockStmt.first.mockResolvedValue(null);

			const status = await service.getUserStatus("nonexistent");

			expect(status).toEqual({ registered: false });
		});
	});

	describe("getUserCount", () => {
		let service: DatabaseService;
		let mockDb: any;
		let mockStmt: any;

		beforeEach(() => {
			const mocks = createMockD1Database();
			mockDb = mocks.mockDb;
			mockStmt = mocks.mockStmt;
			service = new DatabaseService(mockDb as unknown as D1Database);
		});

		it("should return user count successfully", async () => {
			mockStmt.first.mockResolvedValue({ count: 42 });

			const count = await service.getUserCount();

			expect(count).toBe(42);
			expect(mockDb.prepare).toHaveBeenCalledWith(
				"SELECT COUNT(*) as count FROM user_api_keys",
			);
		});

		it("should return 0 when no result", async () => {
			mockStmt.first.mockResolvedValue(null);

			const count = await service.getUserCount();

			expect(count).toBe(0);
		});

		it("should return 0 on error", async () => {
			mockStmt.first.mockRejectedValue(new Error("Database error"));

			const count = await service.getUserCount();

			expect(count).toBe(0);
		});
	});
});

