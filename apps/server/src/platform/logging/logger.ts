type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
	[key: string]: unknown;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
	const line = JSON.stringify({
		ts: new Date().toISOString(),
		level,
		message,
		...sanitize(fields),
	});
	if (level === "error") {
		console.error(line);
	} else if (level === "warn") {
		console.warn(line);
	} else {
		console.log(line);
	}
}

const REDACT_KEYS = new Set([
	"password",
	"token",
	"sessiontoken",
	"authorization",
	"cookie",
	"fingerprint",
	"secret",
]);

function sanitize(fields: LogFields): LogFields {
	const out: LogFields = {};
	for (const [key, value] of Object.entries(fields)) {
		if (REDACT_KEYS.has(key.toLowerCase())) {
			out[key] = "[redacted]";
		} else if (value instanceof Error) {
			out[key] = { name: value.name, message: value.message };
		} else {
			out[key] = value;
		}
	}
	return out;
}

export const logger = {
	debug: (message: string, fields?: LogFields) =>
		emit("debug", message, fields),
	info: (message: string, fields?: LogFields) => emit("info", message, fields),
	warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
	error: (message: string, fields?: LogFields) =>
		emit("error", message, fields),
	audit: (action: string, fields?: LogFields) =>
		emit("info", "audit", { audit: true, action, ...fields }),
};
