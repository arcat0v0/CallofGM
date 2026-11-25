import { z } from "zod";

/**
 * 检查字符码点是否属于禁止的控制或方向伪装字符：
 * - C0 控制字符（0x0000-0x001F，多行文本允许 \t 与 \n）
 * - DEL 与 C1 控制字符（0x007F-0x009F，含 CSI 转义序列）
 * - Unicode 双向覆写与隔离控制符（0x202A-0x202E, 0x2066-0x2069，防止 Trojan Source / 界面文本伪装）
 */
function isUnsafeCharCode(code: number, allowNewlineAndTab: boolean): boolean {
	if (allowNewlineAndTab && (code === 0x09 || code === 0x0a)) {
		return false;
	}
	if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
		return true;
	}
	return (
		(code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
	);
}

export function normalizeLineEndings(value: string): string {
	return value.replace(/\r\n?/g, "\n");
}

export function hasUnsafeSingleLineChars(value: string): boolean {
	for (let index = 0; index < value.length; index += 1) {
		if (isUnsafeCharCode(value.charCodeAt(index), false)) {
			return true;
		}
	}
	return false;
}

export function hasUnsafeMultiLineChars(value: string): boolean {
	const normalized = normalizeLineEndings(value);
	for (let index = 0; index < normalized.length; index += 1) {
		if (isUnsafeCharCode(normalized.charCodeAt(index), true)) {
			return true;
		}
	}
	return false;
}

export function safeSingleLineText(options: { min?: number; max: number }) {
	const min = options.min ?? 0;
	const max = options.max;
	const rawLimit = Math.max(max * 2, max + 256);
	const checked = (
		min > 0 ? z.string().min(min).max(max) : z.string().max(max)
	).refine((value) => !hasUnsafeSingleLineChars(value), {
		message: "Text contains disallowed control or bidirectional characters",
	});
	return z
		.string()
		.max(rawLimit)
		.transform((value) => value.trim())
		.pipe(checked);
}

export function safeMultiLineText(options: { min?: number; max: number }) {
	const min = options.min ?? 0;
	const max = options.max;
	const rawLimit = Math.max(max * 2, max + 256);
	const checked = (
		min > 0 ? z.string().min(min).max(max) : z.string().max(max)
	).refine((value) => !hasUnsafeMultiLineChars(value), {
		message: "Text contains disallowed control or bidirectional characters",
	});
	return z
		.string()
		.max(rawLimit)
		.transform((value) => normalizeLineEndings(value).trim())
		.pipe(checked);
}
