import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { maskSecret, SecretBox } from "@/platform/security/secret-box";

describe("SecretBox AES-256-GCM encryption", () => {
	test("encrypts and decrypts using env secret", () => {
		const box = new SecretBox({
			databaseUrl: ":memory:",
			envSecret: "my-super-secret-master-key",
		});
		expect(box.source).toBe("env");
		const envelope = box.encrypt("aliyun-sk-1234567890abcd");
		expect(envelope.v).toBe(1);
		expect(envelope.ct).not.toContain("aliyun-sk");
		expect(envelope.mask).toBe("****abcd");
		expect(box.decrypt(envelope)).toBe("aliyun-sk-1234567890abcd");
	});

	test("auto-generates a 0600 keyfile next to database and persists across restarts", () => {
		const dir = mkdtempSync(join(tmpdir(), "cogm-secret-box-"));
		try {
			const dbPath = join(dir, "db.sqlite");
			const box1 = new SecretBox({ databaseUrl: dbPath });
			expect(box1.source).toBe("keyfile");
			const mode = statSync(join(dir, "settings.key")).mode & 0o777;
			expect(mode).toBe(0o600);

			const encrypted = box1.encrypt("turn-secret-xyz9876");

			const box2 = new SecretBox({ databaseUrl: dbPath });
			expect(box2.source).toBe("keyfile");
			expect(box2.decrypt(encrypted)).toBe("turn-secret-xyz9876");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	test("rejects tampered ciphertext or authentication tag", () => {
		const box = new SecretBox({
			databaseUrl: ":memory:",
			envSecret: "tamper-test-key",
		});
		const envelope = box.encrypt("sensitive-value");
		const tampered = {
			...envelope,
			ct: Buffer.from("tampered-bytes").toString("base64"),
		};
		expect(() => box.decrypt(tampered)).toThrow();
	});

	test("maskSecret hides short values completely and preserves last 4 chars otherwise", () => {
		expect(maskSecret("ab")).toBe("****");
		expect(maskSecret("1234")).toBe("****");
		expect(maskSecret("12345678")).toBe("****5678");
	});
});
