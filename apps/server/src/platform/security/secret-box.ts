import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export type SecretKeySource = "env" | "keyfile" | "ephemeral";

export interface EncryptedSecretEnvelope {
	v: 1;
	iv: string;
	tag: string;
	ct: string;
	mask: string;
}

export function maskSecret(plaintext: string): string {
	const trimmed = plaintext.trim();
	if (trimmed.length <= 4) {
		return "****";
	}
	return `****${trimmed.slice(-4)}`;
}

function deriveKey(raw: string | Buffer): Buffer {
	return createHash("sha256").update(raw).digest();
}

export function isEncryptedSecretEnvelope(
	value: unknown,
): value is EncryptedSecretEnvelope {
	if (!value || typeof value !== "object") {
		return false;
	}
	const record = value as Record<string, unknown>;
	return (
		record.v === 1 &&
		typeof record.iv === "string" &&
		typeof record.tag === "string" &&
		typeof record.ct === "string" &&
		typeof record.mask === "string"
	);
}

export class SecretBox {
	private readonly key: Buffer;
	readonly source: SecretKeySource;

	constructor(options: {
		databaseUrl: string;
		envSecret?: string;
		keyFilePath?: string;
	}) {
		const envSecret = options.envSecret?.trim();
		if (envSecret) {
			this.key = deriveKey(envSecret);
			this.source = "env";
			return;
		}

		if (options.databaseUrl === ":memory:" && !options.keyFilePath) {
			this.key = randomBytes(32);
			this.source = "ephemeral";
			return;
		}

		const keyPath =
			options.keyFilePath ?? join(dirname(options.databaseUrl), "settings.key");
		if (existsSync(keyPath)) {
			const raw = readFileSync(keyPath, "utf8").trim();
			if (/^[0-9a-f]{64}$/i.test(raw)) {
				this.key = Buffer.from(raw, "hex");
			} else {
				this.key = deriveKey(raw);
			}
			this.source = "keyfile";
			return;
		}

		mkdirSync(dirname(keyPath), { recursive: true });
		const generated = randomBytes(32);
		writeFileSync(keyPath, `${generated.toString("hex")}\n`, { mode: 0o600 });
		try {
			chmodSync(keyPath, 0o600);
		} catch {
			// Best-effort permission hardening on platforms supporting POSIX chmod.
		}
		this.key = generated;
		this.source = "keyfile";
	}

	encrypt(plaintext: string): EncryptedSecretEnvelope {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", this.key, iv);
		const ciphertext = Buffer.concat([
			cipher.update(plaintext, "utf8"),
			cipher.final(),
		]);
		const tag = cipher.getAuthTag();
		return {
			v: 1,
			iv: iv.toString("base64"),
			tag: tag.toString("base64"),
			ct: ciphertext.toString("base64"),
			mask: maskSecret(plaintext),
		};
	}

	decrypt(envelope: EncryptedSecretEnvelope): string {
		const iv = Buffer.from(envelope.iv, "base64");
		const tag = Buffer.from(envelope.tag, "base64");
		const ct = Buffer.from(envelope.ct, "base64");
		const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
		decipher.setAuthTag(tag);
		const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
		return plaintext.toString("utf8");
	}
}
