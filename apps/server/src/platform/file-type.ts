import { inflateRawSync } from "node:zlib";
import { zipSync } from "fflate";
import { AppError } from "@/platform/errors/app-error";

const XLSX_MIME_TYPE =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLSX_WORKBOOK_CONTENT_TYPE =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
const CONTENT_TYPES_NAMESPACE =
	"http://schemas.openxmlformats.org/package/2006/content-types";
const WORKBOOK_NAMESPACE =
	"http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export const MAX_XLSX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_OOXML_METADATA_BYTES = 4 * 1024 * 1024;
const MAX_OOXML_OVERRIDES = 4096;
const MAX_XLSX_ENTRIES = 1024;
const MAX_XLSX_SHEETS = 128;
const MAX_XLSX_CELL_TAGS = 50_000;
const MAX_XLSX_ROW_TAGS = 50_000;
const MAX_XLSX_SHARED_STRINGS = 50_000;
const MAX_XLSX_XML_TAGS = 500_000;
const MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
const MAX_XLSX_COMPRESSION_RATIO = 200;
const MAX_XLSX_RATIO_EXEMPT_BYTES = 64 * 1024;
const MAX_EOCD_COMMENT_BYTES = 65_535;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_U16_SENTINEL = 0xffff;
const ZIP64_U32_SENTINEL = 0xffffffff;
const ZIP64_EXTRA_HEADER_ID = 0x0001;
const ZIP_DATA_DESCRIPTOR_FLAG = 0x0008;

const MAX_FTYP_BOX_BYTES = 1024;
const MAX_OGG_SCAN_BYTES = 64 * 1024;
const MAX_OGG_PAGES = 16;
const MAX_MP4_BOX_DEPTH = 12;
const MAX_MP4_BOXES = 65_536;

const AUDIO_M4A_BRANDS = new Set(["M4A ", "M4B "]);
const AUDIO_M4A_CONTAINER_BRANDS = new Set(["isom", "mp42", "mp41", "qt  "]);
const VIDEO_MP4_BRANDS = new Set(["M4V ", "avc1", "hvc1", "hev1"]);
const MP4_CONTAINER_BOXES = new Set(["moov", "trak", "mdia"]);

function matchesBytes(data: Uint8Array, offset: number, expected: number[]) {
	if (data.length < offset + expected.length) {
		return false;
	}
	for (let i = 0; i < expected.length; i += 1) {
		if (data[offset + i] !== expected[i]) {
			return false;
		}
	}
	return true;
}

function matchesAscii(data: Uint8Array, offset: number, expected: string) {
	if (data.length < offset + expected.length) {
		return false;
	}
	for (let i = 0; i < expected.length; i += 1) {
		if (data[offset + i] !== expected.charCodeAt(i)) {
			return false;
		}
	}
	return true;
}

function asciiAt(data: Uint8Array, start: number, end: number): string {
	let out = "";
	for (let i = start; i < end; i += 1) {
		out += String.fromCharCode(data[i] ?? 0);
	}
	return out;
}

function hasExtraZip64Field(
	data: Uint8Array,
	start: number,
	length: number,
): boolean {
	if (start + length > data.length) {
		return true;
	}
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	let pos = start;
	const end = start + length;
	while (pos + 4 <= end) {
		const id = view.getUint16(pos, true);
		const size = view.getUint16(pos + 2, true);
		if (id === ZIP64_EXTRA_HEADER_ID) {
			return true;
		}
		pos += 4 + size;
	}
	return false;
}

function isAudioOggStream(data: Uint8Array): boolean {
	if (data.length < 28 || !matchesAscii(data, 0, "OggS") || data[4] !== 0x00) {
		return false;
	}
	const scanLimit = Math.min(data.length, MAX_OGG_SCAN_BYTES);
	let offset = 0;
	let pages = 0;
	let hasAudioBos = false;
	let hasVideoBos = false;

	while (offset + 27 <= scanLimit && pages < MAX_OGG_PAGES) {
		if (!matchesAscii(data, offset, "OggS") || data[offset + 4] !== 0x00) {
			break;
		}
		const headerType = data[offset + 5] ?? 0;
		const segmentCount = data[offset + 26] ?? 0;
		const lacingStart = offset + 27;
		const payloadStart = lacingStart + segmentCount;
		if (payloadStart > scanLimit) {
			break;
		}
		let payloadSize = 0;
		for (let i = 0; i < segmentCount; i += 1) {
			payloadSize += data[lacingStart + i] ?? 0;
		}
		const nextOffset = payloadStart + payloadSize;
		if (nextOffset > scanLimit) {
			break;
		}
		const isBos = (headerType & 0x02) !== 0;
		if (isBos) {
			const remaining = nextOffset - payloadStart;
			if (
				remaining >= 7 &&
				data[payloadStart] === 0x01 &&
				matchesAscii(data, payloadStart + 1, "vorbis")
			) {
				hasAudioBos = true;
			} else if (
				remaining >= 8 &&
				matchesAscii(data, payloadStart, "OpusHead")
			) {
				hasAudioBos = true;
			} else if (
				remaining >= 8 &&
				matchesAscii(data, payloadStart, "Speex   ")
			) {
				hasAudioBos = true;
			} else if (
				remaining >= 5 &&
				data[payloadStart] === 0x7f &&
				matchesAscii(data, payloadStart + 1, "FLAC")
			) {
				hasAudioBos = true;
			} else if (
				remaining >= 7 &&
				data[payloadStart] === 0x80 &&
				matchesAscii(data, payloadStart + 1, "theora")
			) {
				hasVideoBos = true;
			} else if (
				remaining < 8 ||
				!matchesAscii(data, payloadStart, "fishead\x00")
			) {
				return false;
			}
		} else if (pages > 0) {
			break;
		}
		offset = nextOffset;
		pages += 1;
	}

	return hasAudioBos && !hasVideoBos;
}

interface Mp4ScanState {
	boxesScanned: number;
	hasSounTrack: boolean;
	hasVideTrack: boolean;
	malformed: boolean;
}

function scanMp4BoxTree(
	data: Uint8Array,
	view: DataView,
	start: number,
	end: number,
	depth: number,
	state: Mp4ScanState,
): void {
	if (depth > MAX_MP4_BOX_DEPTH || state.malformed) {
		return;
	}
	let offset = start;
	while (offset + 8 <= end) {
		if (state.boxesScanned >= MAX_MP4_BOXES) {
			state.malformed = true;
			return;
		}
		state.boxesScanned += 1;
		const size32 = view.getUint32(offset, false);
		const boxType = asciiAt(data, offset + 4, offset + 8);
		let headerSize = 8;
		let boxSize = size32;
		if (size32 === 1) {
			if (offset + 16 > end) {
				state.malformed = true;
				return;
			}
			const hi = view.getUint32(offset + 8, false);
			const lo = view.getUint32(offset + 12, false);
			boxSize = hi * 0x1_0000_0000 + lo;
			headerSize = 16;
		} else if (size32 === 0) {
			boxSize = end - offset;
		}
		if (boxSize < headerSize) {
			state.malformed = true;
			return;
		}
		const boxEnd = offset + boxSize;
		if (boxEnd > end) {
			state.malformed = true;
			return;
		}

		if (boxType === "hdlr") {
			const payloadStart = offset + headerSize;
			if (payloadStart + 12 <= boxEnd) {
				const handlerType = asciiAt(data, payloadStart + 8, payloadStart + 12);
				if (handlerType === "soun") {
					state.hasSounTrack = true;
				} else if (handlerType === "vide") {
					state.hasVideTrack = true;
					return;
				}
			}
		} else if (MP4_CONTAINER_BOXES.has(boxType)) {
			scanMp4BoxTree(data, view, offset + headerSize, boxEnd, depth + 1, state);
			if (state.hasVideTrack || state.malformed) {
				return;
			}
		}

		offset = boxEnd;
	}
}

function isAudioM4aContainer(data: Uint8Array): boolean {
	if (data.length < 16 || !matchesAscii(data, 4, "ftyp")) {
		return false;
	}
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const boxSize = view.getUint32(0, false);
	if (boxSize < 16 || boxSize > MAX_FTYP_BOX_BYTES || boxSize % 4 !== 0) {
		return false;
	}
	if (boxSize > data.length) {
		return false;
	}
	const majorBrand = asciiAt(data, 8, 12);
	const compatibleBrands: string[] = [];
	for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
		compatibleBrands.push(asciiAt(data, offset, offset + 4));
	}
	if (compatibleBrands.some((brand) => VIDEO_MP4_BRANDS.has(brand))) {
		return false;
	}
	if (VIDEO_MP4_BRANDS.has(majorBrand)) {
		return false;
	}

	const hasAudioBrand =
		AUDIO_M4A_BRANDS.has(majorBrand) ||
		(AUDIO_M4A_CONTAINER_BRANDS.has(majorBrand) &&
			compatibleBrands.some((brand) => AUDIO_M4A_BRANDS.has(brand)));
	const hasNeutralIsoBrand = AUDIO_M4A_CONTAINER_BRANDS.has(majorBrand);

	if (!hasAudioBrand && !hasNeutralIsoBrand) {
		return false;
	}

	const state: Mp4ScanState = {
		boxesScanned: 0,
		hasSounTrack: false,
		hasVideTrack: false,
		malformed: false,
	};
	scanMp4BoxTree(data, view, boxSize, data.length, 0, state);

	return !state.hasVideTrack && !state.malformed && state.hasSounTrack;
}

export function detectFileMimeType(data: Uint8Array): string | null {
	if (matchesBytes(data, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return "image/png";
	}
	if (matchesBytes(data, 0, [0xff, 0xd8, 0xff])) {
		return "image/jpeg";
	}
	if (matchesAscii(data, 0, "GIF8")) {
		return "image/gif";
	}
	if (matchesAscii(data, 0, "RIFF") && matchesAscii(data, 8, "WEBP")) {
		return "image/webp";
	}
	if (matchesAscii(data, 0, "RIFF") && matchesAscii(data, 8, "WAVE")) {
		return "audio/wav";
	}
	if (matchesBytes(data, 0, [0x50, 0x4b, 0x03, 0x04])) {
		return XLSX_MIME_TYPE;
	}
	if (matchesAscii(data, 0, "ID3")) {
		return "audio/mpeg";
	}
	const b0 = data[0];
	const b1 = data[1];
	if (
		data.length >= 2 &&
		b0 === 0xff &&
		b1 !== undefined &&
		(b1 & 0xe0) === 0xe0 &&
		(b1 & 0x18) !== 0x08 &&
		(b1 & 0x06) !== 0x00
	) {
		return "audio/mpeg";
	}
	if (data.length >= 5 && matchesAscii(data, 0, "OggS") && data[4] === 0x00) {
		return isAudioOggStream(data) ? "audio/ogg" : null;
	}
	if (data.length >= 5 && matchesAscii(data, 0, "fLaC")) {
		return "audio/flac";
	}
	if (isAudioM4aContainer(data)) {
		return "audio/mp4";
	}

	const previewLen = Math.min(data.length, 1024);
	const text = new TextDecoder("utf-8", { fatal: false })
		.decode(data.subarray(0, previewLen))
		.trim();

	if (
		text.includes("<svg") &&
		(text.startsWith("<?xml") ||
			text.startsWith("<svg") ||
			text.includes('xmlns="http://www.w3.org/2000/svg"'))
	) {
		return "image/svg+xml";
	}

	return null;
}

export function invalidXlsxWorkbookError(): AppError {
	return new AppError("INVALID_FILE_CONTENT", "Invalid workbook content", 400);
}

export function assertXlsxUploadSize(byteLength: number): void {
	if (byteLength > MAX_XLSX_UPLOAD_BYTES) {
		throw new AppError(
			"FILE_SIZE_EXCEEDED",
			"File size exceeds the maximum limit of 10MB",
			400,
		);
	}
}

function normalizeZipPath(name: string): string {
	return name.replace(/^\/+/, "");
}

function extractXmlAttribute(tag: string, attribute: string): string | null {
	const pattern = new RegExp(
		`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
		"i",
	);
	const match = pattern.exec(tag);
	return match ? (match[1] ?? match[2] ?? null) : null;
}

function countXmlMarkers(xml: string, stopAfter: number) {
	let count = 0;
	let offset = -1;
	for (;;) {
		offset = xml.indexOf("<", offset + 1);
		if (offset === -1) {
			break;
		}
		count += 1;
		if (count > stopAfter) {
			return count;
		}
	}
	return count;
}

function countXmlTags(xml: string, localName: string, stopAfter: number) {
	const pattern = new RegExp(
		`<(?:[a-zA-Z_][\\w.-]*:)?${localName}(?=[\\s/>])`,
		"g",
	);
	let count = 0;
	while (pattern.exec(xml) !== null) {
		count += 1;
		if (count > stopAfter) {
			return count;
		}
	}
	return count;
}

function stripXmlPreamble(xml: string): string {
	return xml
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/<\?[\s\S]*?\?>/g, "")
		.replace(/<!DOCTYPE[\s\S]*?>/gi, "")
		.trimStart();
}

function rootBindsNamespace(
	xml: string,
	localName: string,
	namespace: string,
): boolean {
	const match = new RegExp(
		`^<(?:([a-zA-Z_][\\w.-]*):)?${localName}\\b[^>]*>`,
	).exec(xml);
	if (!match) {
		return false;
	}
	const prefix = match[1] ?? null;
	const attribute = prefix ? `xmlns:${prefix}` : "xmlns";
	return extractXmlAttribute(match[0], attribute) === namespace;
}

function hasValidXlsxContentTypes(xml: string): boolean {
	const cleaned = stripXmlPreamble(xml);
	if (
		!rootBindsNamespace(cleaned, "Types", CONTENT_TYPES_NAMESPACE) ||
		!/<\/(?:[a-zA-Z_][\w.-]*:)?Types\s*>/.test(cleaned)
	) {
		return false;
	}
	const overridePattern = /<(?:[a-zA-Z_][\w.-]*:)?Override\b[^>]*>/gi;
	let overrides = 0;
	let workbookOverrides = 0;
	let validWorkbookPart = false;
	let match: RegExpExecArray | null = overridePattern.exec(cleaned);
	while (match !== null) {
		overrides += 1;
		if (overrides > MAX_OOXML_OVERRIDES) {
			return false;
		}
		const tag = match[0];
		const partName = extractXmlAttribute(tag, "PartName");
		const contentType = extractXmlAttribute(tag, "ContentType");
		if (contentType === XLSX_WORKBOOK_CONTENT_TYPE) {
			workbookOverrides += 1;
			if (partName && normalizeZipPath(partName) === "xl/workbook.xml") {
				validWorkbookPart = true;
			}
		}
		match = overridePattern.exec(cleaned);
	}
	return workbookOverrides === 1 && validWorkbookPart;
}

function hasValidWorkbookXml(xml: string): boolean {
	const cleaned = stripXmlPreamble(xml);
	if (
		!rootBindsNamespace(cleaned, "workbook", WORKBOOK_NAMESPACE) ||
		countXmlTags(cleaned, "sheet", MAX_XLSX_SHEETS) > MAX_XLSX_SHEETS
	) {
		return false;
	}
	return (
		/<\/(?:[a-zA-Z_][\w.-]*:)?workbook\s*>/.test(cleaned) ||
		/<(?:[a-zA-Z_][\w.-]*:)?workbook\b[^>]*\/>/.test(cleaned)
	);
}

function findZipEocdOffset(data: Uint8Array, view: DataView): number {
	if (data.length < 22) {
		return -1;
	}
	const minOffset = Math.max(0, data.length - 22 - MAX_EOCD_COMMENT_BYTES);
	for (let offset = data.length - 22; offset >= minOffset; offset -= 1) {
		if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
			const commentLength = view.getUint16(offset + 20, true);
			if (offset + 22 + commentLength === data.length) {
				return offset;
			}
		}
	}
	return -1;
}

interface ZipEntry {
	name: string;
	method: number;
	compressedSize: number;
	uncompressedSize: number;
	dataStart: number;
}

function preflightZipArchive(data: Uint8Array): ZipEntry[] {
	if (!matchesBytes(data, 0, [0x50, 0x4b, 0x03, 0x04])) {
		throw invalidXlsxWorkbookError();
	}
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const eocdOffset = findZipEocdOffset(data, view);
	if (eocdOffset < 0) {
		throw invalidXlsxWorkbookError();
	}
	if (
		eocdOffset >= 20 &&
		view.getUint32(eocdOffset - 20, true) === ZIP64_EOCD_LOCATOR_SIGNATURE
	) {
		throw invalidXlsxWorkbookError();
	}

	const diskNumber = view.getUint16(eocdOffset + 4, true);
	const cdDiskNumber = view.getUint16(eocdOffset + 6, true);
	const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
	const totalEntries = view.getUint16(eocdOffset + 10, true);
	const cdSize = view.getUint32(eocdOffset + 12, true);
	const cdOffset = view.getUint32(eocdOffset + 16, true);

	if (
		diskNumber !== 0 ||
		cdDiskNumber !== 0 ||
		entriesOnDisk !== totalEntries ||
		entriesOnDisk === ZIP64_U16_SENTINEL ||
		totalEntries === ZIP64_U16_SENTINEL ||
		cdSize === ZIP64_U32_SENTINEL ||
		cdOffset === ZIP64_U32_SENTINEL
	) {
		throw invalidXlsxWorkbookError();
	}
	if (totalEntries === 0 || totalEntries > MAX_XLSX_ENTRIES) {
		throw invalidXlsxWorkbookError();
	}
	if (cdOffset > eocdOffset || cdSize > eocdOffset - cdOffset) {
		throw invalidXlsxWorkbookError();
	}

	const cdEnd = cdOffset + cdSize;
	const entries: ZipEntry[] = [];
	let cursor = cdOffset;
	let parsedEntries = 0;
	let totalDeclaredUncompressed = 0;
	let totalDeclaredCompressed = 0;

	while (cursor < cdEnd) {
		if (cursor + 46 > cdEnd) {
			throw invalidXlsxWorkbookError();
		}
		if (view.getUint32(cursor, true) !== CENTRAL_DIR_SIGNATURE) {
			throw invalidXlsxWorkbookError();
		}

		const flags = view.getUint16(cursor + 8, true);
		const method = view.getUint16(cursor + 10, true);
		const compressedSize = view.getUint32(cursor + 20, true);
		const uncompressedSize = view.getUint32(cursor + 24, true);
		const nameLength = view.getUint16(cursor + 28, true);
		const extraLength = view.getUint16(cursor + 30, true);
		const commentLength = view.getUint16(cursor + 32, true);
		const entryDiskNumber = view.getUint16(cursor + 34, true);
		const localHeaderOffset = view.getUint32(cursor + 42, true);

		const recordLength = 46 + nameLength + extraLength + commentLength;
		if (cursor + recordLength > cdEnd || nameLength === 0) {
			throw invalidXlsxWorkbookError();
		}
		if (
			entryDiskNumber !== 0 ||
			compressedSize === ZIP64_U32_SENTINEL ||
			uncompressedSize === ZIP64_U32_SENTINEL ||
			localHeaderOffset === ZIP64_U32_SENTINEL ||
			hasExtraZip64Field(data, cursor + 46 + nameLength, extraLength)
		) {
			throw invalidXlsxWorkbookError();
		}
		if ((flags & 0x0001) !== 0 || (method !== 0 && method !== 8)) {
			throw invalidXlsxWorkbookError();
		}
		if (method === 0 && compressedSize !== uncompressedSize) {
			throw invalidXlsxWorkbookError();
		}
		if (
			uncompressedSize > MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES ||
			compressedSize > cdOffset
		) {
			throw invalidXlsxWorkbookError();
		}
		if (
			uncompressedSize > MAX_XLSX_RATIO_EXEMPT_BYTES &&
			(compressedSize === 0 ||
				uncompressedSize / compressedSize > MAX_XLSX_COMPRESSION_RATIO)
		) {
			throw invalidXlsxWorkbookError();
		}

		if (localHeaderOffset + 30 > cdOffset) {
			throw invalidXlsxWorkbookError();
		}
		if (view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_SIGNATURE) {
			throw invalidXlsxWorkbookError();
		}

		const localFlags = view.getUint16(localHeaderOffset + 6, true);
		const localMethod = view.getUint16(localHeaderOffset + 8, true);
		const localCompressedSize = view.getUint32(localHeaderOffset + 18, true);
		const localUncompressedSize = view.getUint32(localHeaderOffset + 22, true);
		const localNameLength = view.getUint16(localHeaderOffset + 26, true);
		const localExtraLength = view.getUint16(localHeaderOffset + 28, true);

		if (
			localMethod !== method ||
			localNameLength !== nameLength ||
			localHeaderOffset + 30 + localNameLength + localExtraLength > cdOffset ||
			hasExtraZip64Field(
				data,
				localHeaderOffset + 30 + localNameLength,
				localExtraLength,
			)
		) {
			throw invalidXlsxWorkbookError();
		}
		for (let i = 0; i < nameLength; i += 1) {
			if (data[cursor + 46 + i] !== data[localHeaderOffset + 30 + i]) {
				throw invalidXlsxWorkbookError();
			}
		}

		const dataStart =
			localHeaderOffset + 30 + localNameLength + localExtraLength;
		if (dataStart + compressedSize > cdOffset) {
			throw invalidXlsxWorkbookError();
		}

		const usesDataDescriptor = (localFlags & ZIP_DATA_DESCRIPTOR_FLAG) !== 0;
		if (!usesDataDescriptor) {
			if (
				localCompressedSize !== compressedSize ||
				localUncompressedSize !== uncompressedSize
			) {
				throw invalidXlsxWorkbookError();
			}
		} else {
			if (
				(localCompressedSize !== 0 && localCompressedSize !== compressedSize) ||
				(localUncompressedSize !== 0 &&
					localUncompressedSize !== uncompressedSize)
			) {
				throw invalidXlsxWorkbookError();
			}
		}

		totalDeclaredUncompressed += uncompressedSize;
		totalDeclaredCompressed += compressedSize;
		if (
			totalDeclaredUncompressed > MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES ||
			totalDeclaredCompressed > cdOffset
		) {
			throw invalidXlsxWorkbookError();
		}
		if (
			totalDeclaredUncompressed > MAX_XLSX_RATIO_EXEMPT_BYTES &&
			(totalDeclaredCompressed === 0 ||
				totalDeclaredUncompressed / totalDeclaredCompressed >
					MAX_XLSX_COMPRESSION_RATIO)
		) {
			throw invalidXlsxWorkbookError();
		}

		entries.push({
			name: new TextDecoder("utf-8", { fatal: false }).decode(
				data.subarray(cursor + 46, cursor + 46 + nameLength),
			),
			method,
			compressedSize,
			uncompressedSize,
			dataStart,
		});
		parsedEntries += 1;
		if (parsedEntries > totalEntries) {
			throw invalidXlsxWorkbookError();
		}
		cursor += recordLength;
	}

	if (parsedEntries !== totalEntries || cursor !== cdEnd) {
		throw invalidXlsxWorkbookError();
	}
	return entries;
}

function inflateZipEntry(data: Uint8Array, entry: ZipEntry): Uint8Array {
	const payload = data.subarray(
		entry.dataStart,
		entry.dataStart + entry.compressedSize,
	);
	if (entry.method === 0) {
		return payload;
	}
	try {
		const maxOutputLength = Math.min(
			entry.uncompressedSize,
			MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES,
		);
		const inflated = inflateRawSync(payload, {
			maxOutputLength: Math.max(1, maxOutputLength + 1),
		});
		if (inflated.byteLength !== entry.uncompressedSize) {
			throw invalidXlsxWorkbookError();
		}
		return new Uint8Array(
			inflated.buffer,
			inflated.byteOffset,
			inflated.byteLength,
		);
	} catch (error) {
		if (error instanceof AppError) {
			throw error;
		}
		throw invalidXlsxWorkbookError();
	}
}

export function sanitizeXlsxWorkbook(data: Uint8Array): ArrayBuffer {
	const entries = preflightZipArchive(data);
	const seen = new Set<string>();
	const seenLower = new Set<string>();
	const files = Object.create(null) as Record<string, Uint8Array>;
	let remaining = MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES;

	for (const entry of entries) {
		const name = normalizeZipPath(entry.name);
		if (!name || name.endsWith("/")) {
			continue;
		}
		const lowerName = name.toLowerCase();
		const segments = name.split("/");
		if (
			seen.has(name) ||
			seenLower.has(lowerName) ||
			name === "__proto__" ||
			name.includes("\\") ||
			lowerName === "root entry" ||
			lowerName.startsWith("root entry/") ||
			lowerName === "xl/vbaproject.bin" ||
			segments.some(
				(segment) =>
					segment.length === 0 ||
					segment === "." ||
					segment === ".." ||
					segment.includes("\0"),
			)
		) {
			throw invalidXlsxWorkbookError();
		}
		seen.add(name);
		seenLower.add(lowerName);
		const content = inflateZipEntry(data, entry);
		if (
			content.byteLength !== entry.uncompressedSize ||
			content.byteLength > remaining
		) {
			throw invalidXlsxWorkbookError();
		}
		if (
			(name === "[Content_Types].xml" || name === "xl/workbook.xml") &&
			(content.byteLength === 0 ||
				content.byteLength > MAX_OOXML_METADATA_BYTES)
		) {
			throw invalidXlsxWorkbookError();
		}
		remaining -= content.byteLength;
		files[name] = content;
	}

	const contentTypesBytes = files["[Content_Types].xml"];
	const workbookBytes = files["xl/workbook.xml"];
	if (!contentTypesBytes || !workbookBytes) {
		throw invalidXlsxWorkbookError();
	}

	const counterDecoder = new TextDecoder("utf-8", { fatal: false });
	let cellTags = 0;
	let rowTags = 0;
	let sharedStrings = 0;
	let sheets = 0;
	let xmlTags = 0;
	for (const [name, content] of Object.entries(files)) {
		const lowerName = name.toLowerCase();
		if (!lowerName.endsWith(".xml") && !lowerName.endsWith(".rels")) {
			continue;
		}
		const xml = counterDecoder.decode(content);
		xmlTags += countXmlMarkers(xml, MAX_XLSX_XML_TAGS - xmlTags);
		cellTags += countXmlTags(xml, "c", MAX_XLSX_CELL_TAGS - cellTags);
		rowTags += countXmlTags(xml, "row", MAX_XLSX_ROW_TAGS - rowTags);
		sharedStrings += countXmlTags(
			xml,
			"si",
			MAX_XLSX_SHARED_STRINGS - sharedStrings,
		);
		sheets += countXmlTags(xml, "sheet", MAX_XLSX_SHEETS - sheets);
		if (
			xmlTags > MAX_XLSX_XML_TAGS ||
			cellTags > MAX_XLSX_CELL_TAGS ||
			rowTags > MAX_XLSX_ROW_TAGS ||
			sharedStrings > MAX_XLSX_SHARED_STRINGS ||
			sheets > MAX_XLSX_SHEETS
		) {
			throw invalidXlsxWorkbookError();
		}
	}

	const decoder = new TextDecoder("utf-8", { fatal: true });
	let contentTypesXml: string;
	let workbookXml: string;
	try {
		contentTypesXml = decoder.decode(contentTypesBytes);
		workbookXml = decoder.decode(workbookBytes);
	} catch {
		throw invalidXlsxWorkbookError();
	}

	if (
		!hasValidXlsxContentTypes(contentTypesXml) ||
		!hasValidWorkbookXml(workbookXml)
	) {
		throw invalidXlsxWorkbookError();
	}

	let safe: Uint8Array;
	try {
		safe = zipSync(files, { level: 0 });
	} catch {
		throw invalidXlsxWorkbookError();
	}
	return safe.buffer.slice(
		safe.byteOffset,
		safe.byteOffset + safe.byteLength,
	) as ArrayBuffer;
}
