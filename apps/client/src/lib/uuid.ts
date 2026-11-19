/**
 * Generate an RFC 4122 v4 UUID string without requiring a secure context
 * (browsers omit `crypto.randomUUID` on plain HTTP origins such as LAN IPs).
 */
export function randomUuid(): string {
	const cryptoObj = globalThis.crypto;
	if (typeof cryptoObj?.randomUUID === "function") {
		return cryptoObj.randomUUID();
	}
	const bytes = new Uint8Array(16);
	if (typeof cryptoObj?.getRandomValues === "function") {
		cryptoObj.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i += 1) {
			bytes[i] = Math.floor(Math.random() * 256);
		}
	}
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
