import { describe, expect, test } from "bun:test";
import { zipSync } from "fflate";
import * as xlsx from "xlsx";
import { detectFileMimeType, sanitizeXlsxWorkbook } from "@/platform/file-type";

function audioBytes(prefix: Uint8Array, trailing = 0): Uint8Array {
	const result = new Uint8Array(prefix.length + trailing);
	result.set(prefix);
	return result;
}

function ftyp(brand: string, compatibleBrands: string[] = []): Uint8Array {
	const size = 16 + compatibleBrands.length * 4;
	const bytes = new Uint8Array(size);
	new DataView(bytes.buffer).setUint32(0, size);
	bytes.set(new TextEncoder().encode("ftyp"), 4);
	bytes.set(new TextEncoder().encode(brand), 8);
	compatibleBrands.forEach((compat, index) => {
		bytes.set(new TextEncoder().encode(compat), 16 + index * 4);
	});
	return bytes;
}

function zipBytes(entries: Record<string, string>): Uint8Array {
	const files: Record<string, Uint8Array> = {};
	for (const [name, content] of Object.entries(entries)) {
		files[name] = new TextEncoder().encode(content);
	}
	return zipSync(files);
}

function xlsxBytes(): ArrayBuffer {
	const workbook = xlsx.utils.book_new();
	xlsx.utils.book_append_sheet(
		workbook,
		xlsx.utils.aoa_to_sheet([
			["姓名", "张三"],
			["力量", 60],
		]),
		"Sheet1",
	);
	return xlsx.write(workbook, {
		type: "array",
		bookType: "xlsx",
	}) as ArrayBuffer;
}

const VALID_CONTENT_TYPES = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`;
const VALID_WORKBOOK = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>`;

function validWorkbookXml(): Record<string, string> {
	return {
		"[Content_Types].xml": VALID_CONTENT_TYPES,
		"xl/workbook.xml": VALID_WORKBOOK,
	};
}

function centralEntries(bytes: Uint8Array) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = bytes.length - 22;
	const cdOffset = view.getUint32(eocd + 16, true);
	const cdSize = view.getUint32(eocd + 12, true);
	const entries: Array<{
		name: string;
		pos: number;
		next: number;
		localOffset: number;
	}> = [];
	let pos = cdOffset;
	while (pos < cdOffset + cdSize) {
		const nameLength = view.getUint16(pos + 28, true);
		const extraLength = view.getUint16(pos + 30, true);
		const commentLength = view.getUint16(pos + 32, true);
		entries.push({
			name: new TextDecoder().decode(
				bytes.subarray(pos + 46, pos + 46 + nameLength),
			),
			pos,
			next: pos + 46 + nameLength + extraLength + commentLength,
			localOffset: view.getUint32(pos + 42, true),
		});
		pos = entries.at(-1)?.next ?? pos;
	}
	return { entries, view };
}

function oggPage(payload: Uint8Array, pageSeq = 0): Uint8Array {
	const page = new Uint8Array(28 + payload.length);
	page.set(new TextEncoder().encode("OggS"), 0);
	page[4] = 0x00;
	page[5] = pageSeq === 0 ? 0x02 : 0x00;
	new DataView(page.buffer).setUint32(18, pageSeq, true);
	page[26] = 1;
	page[27] = payload.length;
	page.set(payload, 28);
	return page;
}

function vorbisOgg(trailing = 0): Uint8Array {
	const header = new Uint8Array(7 + trailing);
	header[0] = 0x01;
	header.set(new TextEncoder().encode("vorbis"), 1);
	return oggPage(header);
}

function opusOgg(): Uint8Array {
	return oggPage(new TextEncoder().encode("OpusHead\x01\x02"));
}

function speexOgg(): Uint8Array {
	return oggPage(new TextEncoder().encode("Speex   1.2"));
}

function flacOgg(): Uint8Array {
	return oggPage(new TextEncoder().encode("\x7fFLAC\x01\x00"));
}

function theoraOgg(): Uint8Array {
	const header = new Uint8Array(7);
	header[0] = 0x80;
	header.set(new TextEncoder().encode("theora"), 1);
	return oggPage(header);
}

function mp4Box(type: string, body: Uint8Array): Uint8Array {
	const out = new Uint8Array(8 + body.length);
	new DataView(out.buffer).setUint32(0, out.length, false);
	out.set(new TextEncoder().encode(type), 4);
	out.set(body, 8);
	return out;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
	const total = chunks.reduce((sum, c) => sum + c.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

function hdlrBox(handlerType: string): Uint8Array {
	const body = new Uint8Array(24);
	body.set(new TextEncoder().encode(handlerType), 8);
	return mp4Box("hdlr", body);
}

function mp4WithTracks(
	majorBrand: string,
	compatibleBrands: string[],
	handlers: string[],
): Uint8Array {
	const traks = handlers.map((handler) =>
		mp4Box("trak", mp4Box("mdia", hdlrBox(handler))),
	);
	const moov = mp4Box("moov", concatBytes(...traks));
	return concatBytes(ftyp(majorBrand, compatibleBrands), moov);
}

describe("detectFileMimeType", () => {
	test("detects each supported audio container from its bytes", () => {
		const cases: Array<[string, Uint8Array]> = [
			[
				"audio/mpeg",
				audioBytes(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0]), 32),
			],
			["audio/mpeg", audioBytes(new Uint8Array([0xff, 0xfb, 0x90, 0x64]))],
			[
				"audio/wav",
				audioBytes(new TextEncoder().encode("RIFF\x00\x00\x00\x00WAVEfmt ")),
			],
			["audio/ogg", vorbisOgg(24)],
			["audio/ogg", opusOgg()],
			["audio/ogg", speexOgg()],
			["audio/ogg", flacOgg()],
			["audio/flac", audioBytes(new TextEncoder().encode("fLaC\x00\x00"))],
			["audio/mp4", mp4WithTracks("M4A ", ["M4A ", "isom"], ["soun"])],
		];
		for (const [expected, bytes] of cases) {
			expect(detectFileMimeType(bytes)).toBe(expected);
		}
	});

	test("accepts audio-only MP4/M4A containers and rejects video-only or mixed-video MP4", () => {
		expect(
			detectFileMimeType(mp4WithTracks("isom", ["isom", "iso2"], ["soun"])),
		).toBe("audio/mp4");
		expect(
			detectFileMimeType(
				mp4WithTracks("mp42", ["mp42", "isom"], ["soun", "meta"]),
			),
		).toBe("audio/mp4");
		expect(
			detectFileMimeType(mp4WithTracks("mp41", ["mp41", "isom"], ["soun"])),
		).toBe("audio/mp4");
		expect(
			detectFileMimeType(mp4WithTracks("qt  ", ["qt  ", "isom"], ["soun"])),
		).toBe("audio/mp4");
		expect(
			detectFileMimeType(mp4WithTracks("isom", ["M4A ", "isom"], ["soun"])),
		).toBe("audio/mp4");
		expect(
			detectFileMimeType(
				mp4WithTracks("isom", ["M4A ", "isom"], ["vide", "soun"]),
			),
		).toBeNull();
		expect(
			detectFileMimeType(mp4WithTracks("mp42", ["mp42", "isom"], ["vide"])),
		).toBeNull();
		expect(
			detectFileMimeType(mp4WithTracks("M4A ", ["M4A "], ["vide"])),
		).toBeNull();
		for (const brand of [
			"M4A ",
			"M4B ",
			"isom",
			"mp42",
			"mp41",
			"avc1",
			"M4V ",
			"qt  ",
			"3gp4",
		]) {
			expect(detectFileMimeType(ftyp(brand))).toBeNull();
		}
		expect(
			detectFileMimeType(ftyp("isom", ["isom", "iso2", "avc1", "mp41"])),
		).toBeNull();
		expect(detectFileMimeType(ftyp("isom", ["M4A ", "avc1"]))).toBeNull();
	});

	test("accepts audio MP4s with many fragment and padding boxes", () => {
		const parts: Uint8Array[] = [
			ftyp("M4A ", ["M4A ", "isom"]),
			mp4Box("moov", mp4Box("trak", mp4Box("mdia", hdlrBox("soun")))),
		];
		for (let index = 0; index < 4100; index += 1) {
			parts.push(mp4Box("free", new Uint8Array(0)));
		}
		expect(detectFileMimeType(concatBytes(...parts))).toBe("audio/mp4");
	});

	test("scans past a large mdat box before deciding whether MP4 has audio", () => {
		const padding = mp4Box("mdat", new Uint8Array(2 * 1024 * 1024 + 16));
		const moov = (handler: string) =>
			mp4Box("moov", mp4Box("trak", mp4Box("mdia", hdlrBox(handler))));
		const audio = concatBytes(
			ftyp("M4A ", ["M4A ", "isom"]),
			padding,
			moov("soun"),
		);
		const video = concatBytes(
			ftyp("M4A ", ["M4A ", "isom"]),
			padding,
			moov("vide"),
		);
		expect(detectFileMimeType(audio)).toBe("audio/mp4");
		expect(detectFileMimeType(video)).toBeNull();
	});

	test("rejects Theora-only or codec-less Ogg streams", () => {
		expect(detectFileMimeType(theoraOgg())).toBeNull();
		expect(
			detectFileMimeType(
				audioBytes(new TextEncoder().encode("OggS\x00\x02"), 32),
			),
		).toBeNull();
	});

	test("requires the WAVE signature and rejects unrelated RIFF containers", () => {
		expect(
			detectFileMimeType(
				new TextEncoder().encode("RIFF\x00\x00\x00\x00AVI LIST"),
			),
		).toBeNull();
		expect(detectFileMimeType(new TextEncoder().encode("RIFFWAVE"))).toBeNull();
	});

	test("rejects truncated signatures, text and MP3 frames that are not audio", () => {
		expect(detectFileMimeType(new Uint8Array([0x49, 0x44]))).toBeNull();
		expect(detectFileMimeType(new TextEncoder().encode("OggS"))).toBeNull();
		expect(detectFileMimeType(new TextEncoder().encode("fLaC"))).toBeNull();
		expect(detectFileMimeType(new Uint8Array([0xff, 0x10, 0x00]))).toBeNull();
		expect(
			detectFileMimeType(new TextEncoder().encode("hello world")),
		).toBeNull();
	});

	test("keeps existing image and OOXML detection", () => {
		expect(
			detectFileMimeType(
				new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			),
		).toBe("image/png");
		expect(
			detectFileMimeType(
				new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]),
			),
		).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		expect(
			detectFileMimeType(
				new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"),
			),
		).toBe("image/svg+xml");
	});
});

describe("sanitizeXlsxWorkbook", () => {
	test("returns a sanitized archive that SheetJS can parse", () => {
		const safe = sanitizeXlsxWorkbook(new Uint8Array(xlsxBytes()));
		const parsed = xlsx.read(safe, { type: "array" });
		expect(parsed.SheetNames).toContain("Sheet1");
	});

	test("requires OOXML namespaces on the content types and workbook roots", () => {
		const noNamespace = VALID_CONTENT_TYPES.replace(
			' xmlns="http://schemas.openxmlformats.org/package/2006/content-types"',
			"",
		);
		const wrongNamespace = VALID_CONTENT_TYPES.replace(
			"http://schemas.openxmlformats.org/package/2006/content-types",
			"http://example.com/wrong",
		);
		for (const contentTypes of [noNamespace, wrongNamespace]) {
			expect(() =>
				sanitizeXlsxWorkbook(
					zipBytes({
						...validWorkbookXml(),
						"[Content_Types].xml": contentTypes,
					}),
				),
			).toThrow("Invalid workbook content");
		}
		expect(() =>
			sanitizeXlsxWorkbook(
				zipBytes({
					...validWorkbookXml(),
					"xl/workbook.xml": "<workbook><sheets/></workbook>",
				}),
			),
		).toThrow("Invalid workbook content");
		expect(() =>
			sanitizeXlsxWorkbook(
				zipBytes({
					...validWorkbookXml(),
					"xl/workbook.xml": `<!--<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"></workbook>--><notWorkbook/>`,
				}),
			),
		).toThrow("Invalid workbook content");
		expect(() =>
			sanitizeXlsxWorkbook(
				zipBytes({
					...validWorkbookXml(),
					"XL/WORKBOOK.XML": VALID_WORKBOOK,
				}),
			),
		).toThrow("Invalid workbook content");
		expect(() =>
			sanitizeXlsxWorkbook(
				zipBytes({
					...validWorkbookXml(),
					"xl\\workbook.xml": VALID_WORKBOOK,
				}),
			),
		).toThrow("Invalid workbook content");
		expect(() =>
			sanitizeXlsxWorkbook(
				zipBytes({
					...validWorkbookXml(),
					"Root Entry/xl/workbook.xml": `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="FROM_ROOT" sheetId="1"/></sheets></workbook>`,
				}),
			),
		).toThrow("Invalid workbook content");
		expect(() =>
			sanitizeXlsxWorkbook(
				zipBytes({
					...validWorkbookXml(),
					"./xl/workbook.xml": VALID_WORKBOOK,
				}),
			),
		).toThrow("Invalid workbook content");

		const duplicateWorkbookOverride = VALID_CONTENT_TYPES.replace(
			"</Types>",
			`<Override PartName="/evil/w.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`,
		);
		expect(() =>
			sanitizeXlsxWorkbook(
				zipBytes({
					...validWorkbookXml(),
					"[Content_Types].xml": duplicateWorkbookOverride,
				}),
			),
		).toThrow("Invalid workbook content");

		const prefixed = sanitizeXlsxWorkbook(
			zipBytes({
				"[Content_Types].xml": `<ct:Types xmlns:ct="http://schemas.openxmlformats.org/package/2006/content-types"><ct:Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></ct:Types>`,
				"xl/workbook.xml": `<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheets/></x:workbook>`,
			}),
		);
		expect(() => xlsx.read(prefixed, { type: "array" })).not.toThrow();
	});

	test("rejects plain text with all declared XLSX attributes and MIME", () => {
		const bytes = new TextEncoder().encode(
			"[Content_Types].xml xl/workbook.xml application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
		);
		expect(() => sanitizeXlsxWorkbook(bytes)).toThrow(
			"Invalid workbook content",
		);
	});

	test("rejects legacy XLS, unrelated ZIPs, truncated ZIPs and macro workbooks", () => {
		const macro = {
			...validWorkbookXml(),
			"[Content_Types].xml": VALID_CONTENT_TYPES.replace(
				"spreadsheetml.sheet.main+xml",
				"spreadsheetml.sheet.macroEnabled.main+xml",
			),
		};
		const invalid = [
			new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
			zipBytes({ "hello.txt": "not a workbook" }),
			zipBytes({
				"[Content_Types].xml": VALID_CONTENT_TYPES,
			}),
			zipBytes({
				"xl/workbook.xml": VALID_WORKBOOK,
			}),
			zipBytes(macro),
			new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
			zipBytes(validWorkbookXml()).subarray(0, -10),
		];
		for (const bytes of invalid) {
			expect(() => sanitizeXlsxWorkbook(bytes)).toThrow(
				"Invalid workbook content",
			);
		}
	});

	test("detects false ZIP size metadata before rebuilding the archive", () => {
		const huge = zipBytes({
			...validWorkbookXml(),
			"huge.bin": "x".repeat(20_000),
		});
		expect(() => sanitizeXlsxWorkbook(huge)).not.toThrow();

		const base = zipBytes(validWorkbookXml());
		const eocd = base.length - 22;
		const cdOffset = new DataView(base.buffer, base.byteOffset).getUint32(
			eocd + 16,
			true,
		);
		const truncatedMeta = new Uint8Array(base);
		new DataView(truncatedMeta.buffer).setUint32(cdOffset + 24, 12, true);
		expect(() => sanitizeXlsxWorkbook(truncatedMeta)).toThrow(
			"Invalid workbook content",
		);

		const hugeMeta = new Uint8Array(base);
		new DataView(hugeMeta.buffer).setUint32(
			cdOffset + 24,
			64 * 1024 * 1024,
			true,
		);
		expect(() => sanitizeXlsxWorkbook(hugeMeta)).toThrow(
			"Invalid workbook content",
		);
	});

	test("rejects ZIP64 sentinel / 0xffffffff count probe and 128MiB unused-entry probe quickly", () => {
		const base = zipBytes(validWorkbookXml());

		const zip64Probe = new Uint8Array(base);
		const eocd = zip64Probe.length - 22;
		const eocdView = new DataView(zip64Probe.buffer, zip64Probe.byteOffset);
		eocdView.setUint16(eocd + 8, 0xffff, true);
		eocdView.setUint16(eocd + 10, 0xffff, true);
		eocdView.setUint32(eocd + 12, 0xffffffff, true);
		eocdView.setUint32(eocd + 16, 0xffffffff, true);
		expect(() => sanitizeXlsxWorkbook(zip64Probe)).toThrow(
			"Invalid workbook content",
		);

		const unusedLarge = zipBytes({
			...validWorkbookXml(),
			"unused.bin": "A".repeat(4096),
		});
		const unusedView = new DataView(unusedLarge.buffer, unusedLarge.byteOffset);
		const unusedEocd = unusedLarge.length - 22;
		const unusedCdOffset = unusedView.getUint32(unusedEocd + 16, true);
		const unusedCdSize = unusedView.getUint32(unusedEocd + 12, true);
		let pos = unusedCdOffset;
		while (pos < unusedCdOffset + unusedCdSize) {
			const nlen = unusedView.getUint16(pos + 28, true);
			const xlen = unusedView.getUint16(pos + 30, true);
			const clen = unusedView.getUint16(pos + 32, true);
			const name = new TextDecoder().decode(
				unusedLarge.subarray(pos + 46, pos + 46 + nlen),
			);
			if (name === "unused.bin") {
				unusedView.setUint32(pos + 24, 128 * 1024 * 1024, true);
				const lhoff = unusedView.getUint32(pos + 42, true);
				unusedView.setUint32(lhoff + 22, 128 * 1024 * 1024, true);
			}
			pos += 46 + nlen + xlen + clen;
		}
		expect(() => sanitizeXlsxWorkbook(unusedLarge)).toThrow(
			"Invalid workbook content",
		);
	});

	test("rejects local/central size mismatch and extreme compression ratio bombs", () => {
		const base = zipBytes(validWorkbookXml());
		const eocd = base.length - 22;
		const cdOffset = new DataView(base.buffer, base.byteOffset).getUint32(
			eocd + 16,
			true,
		);
		const lhoff = new DataView(base.buffer, base.byteOffset).getUint32(
			cdOffset + 42,
			true,
		);
		const localMismatch = new Uint8Array(base);
		new DataView(localMismatch.buffer).setUint32(lhoff + 22, 9999, true);
		expect(() => sanitizeXlsxWorkbook(localMismatch)).toThrow(
			"Invalid workbook content",
		);
	});

	test("rejects data-descriptor streams whose real output exceeds declared sizes", () => {
		const bytes = zipBytes({
			...validWorkbookXml(),
			"xl/unused.bin": "A".repeat(1024 * 1024),
		});
		const { entries, view } = centralEntries(bytes);
		const unused = entries.find((entry) => entry.name === "xl/unused.bin");
		expect(unused).toBeDefined();
		if (!unused) return;

		view.setUint16(
			unused.pos + 8,
			view.getUint16(unused.pos + 8, true) | 8,
			true,
		);
		view.setUint32(unused.pos + 24, 4096, true);
		view.setUint16(
			unused.localOffset + 6,
			view.getUint16(unused.localOffset + 6, true) | 8,
			true,
		);
		view.setUint32(unused.localOffset + 18, 0, true);
		view.setUint32(unused.localOffset + 22, 0, true);

		expect(() => sanitizeXlsxWorkbook(bytes)).toThrow(
			"Invalid workbook content",
		);
	});

	test("enforces workbook, worksheet, shared-string, and total size budgets", () => {
		const tooManySheets = {
			...validWorkbookXml(),
			"xl/workbook.xml": `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets>${'<sheet name="S" sheetId="1"/>'.repeat(129)}</sheets></workbook>`,
		};
		expect(() => sanitizeXlsxWorkbook(zipBytes(tooManySheets))).toThrow(
			"Invalid workbook content",
		);

		const tooManyRows = {
			...validWorkbookXml(),
			"xl/sheets/redirect.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${"<row/>".repeat(50_001)}</sheetData></worksheet>`,
		};
		expect(() => sanitizeXlsxWorkbook(zipBytes(tooManyRows))).toThrow(
			"Invalid workbook content",
		);

		const tooManyStrings = {
			...validWorkbookXml(),
			"xl/sharedStrings.xml": `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${"<si><t>x</t></si>".repeat(50_001)}</sst>`,
		};
		expect(() => sanitizeXlsxWorkbook(zipBytes(tooManyStrings))).toThrow(
			"Invalid workbook content",
		);

		const tooManyTags = {
			...validWorkbookXml(),
			"xl/styles.xml": `<styleSheet>${"<a/>".repeat(500_001)}</styleSheet>`,
		};
		expect(() => sanitizeXlsxWorkbook(zipBytes(tooManyTags))).toThrow(
			"Invalid workbook content",
		);

		const incompressible = new Uint8Array(9 * 1024 * 1024);
		let state = 1;
		for (let index = 0; index < incompressible.length; index += 1) {
			state ^= state << 13;
			state ^= state >>> 17;
			state ^= state << 5;
			incompressible[index] = state & 0xff;
		}
		const encoder = new TextEncoder();
		const tooLarge = zipSync({
			"[Content_Types].xml": encoder.encode(VALID_CONTENT_TYPES),
			"xl/workbook.xml": encoder.encode(VALID_WORKBOOK),
			"xl/data.bin": incompressible,
		});
		expect(() => sanitizeXlsxWorkbook(tooLarge)).toThrow(
			"Invalid workbook content",
		);
	});

	test("rejects reserved prototype entry names before rebuilding", () => {
		const bytes = zipBytes({
			...validWorkbookXml(),
			unusedXYZ: "abc",
		});
		const { entries } = centralEntries(bytes);
		const unused = entries.find((entry) => entry.name === "unusedXYZ");
		expect(unused).toBeDefined();
		if (!unused) return;

		const replacement = new TextEncoder().encode("__proto__");
		for (let index = 0; index < replacement.length; index += 1) {
			bytes[unused.pos + 46 + index] = replacement[index] ?? 0;
			bytes[unused.localOffset + 30 + index] = replacement[index] ?? 0;
		}
		expect(() => sanitizeXlsxWorkbook(bytes)).toThrow(
			"Invalid workbook content",
		);
	});

	test("accepts a legitimate data-descriptor entry with matching sizes", () => {
		const bytes = zipBytes({
			...validWorkbookXml(),
			"xl/unused.bin": "B".repeat(1024),
		});
		const { entries, view } = centralEntries(bytes);
		const unused = entries.find((entry) => entry.name === "xl/unused.bin");
		expect(unused).toBeDefined();
		if (!unused) return;

		view.setUint16(
			unused.pos + 8,
			view.getUint16(unused.pos + 8, true) | 8,
			true,
		);
		view.setUint16(
			unused.localOffset + 6,
			view.getUint16(unused.localOffset + 6, true) | 8,
			true,
		);
		view.setUint32(unused.localOffset + 18, 0, true);
		view.setUint32(unused.localOffset + 22, 0, true);

		const safe = sanitizeXlsxWorkbook(bytes);
		expect(() => xlsx.read(safe, { type: "array" })).not.toThrow();
	});

	test("ignores a fake EOCD hidden in the archive comment", () => {
		const base = zipBytes(validWorkbookXml());
		const comment = new Uint8Array(4096);
		const commentView = new DataView(comment.buffer);
		comment.set([0x50, 0x4b, 0x05, 0x06], 0);
		commentView.setUint16(8, 0xffff, true);
		commentView.setUint16(10, 0xffff, true);
		commentView.setUint32(12, 0xffffffff, true);
		commentView.setUint32(16, 0xffffffff, true);

		const fakeCommentZip = new Uint8Array(base.length + comment.length);
		fakeCommentZip.set(base);
		fakeCommentZip.set(comment, base.length);
		const archiveView = new DataView(
			fakeCommentZip.buffer,
			fakeCommentZip.byteOffset,
			fakeCommentZip.byteLength,
		);
		archiveView.setUint16(base.length - 2, comment.length, true);

		const safe = sanitizeXlsxWorkbook(fakeCommentZip);
		expect(() => xlsx.read(safe, { type: "array" })).not.toThrow();
	});
});
