import { describe, expect, test } from "bun:test";
import { detectFileMimeTypeFromRanges } from "@/platform/file-type";
import {
	extensionForMimeType,
	joinObjectKey,
	normalizeKeyPrefix,
	S3CompatibleClient,
} from "@/platform/storage/s3-client";

describe("S3CompatibleClient URL & SigV4 signing", () => {
	const baseConfig = {
		endpoint: "https://oss-cn-hangzhou-internal.aliyuncs.com",
		publicUploadEndpoint: "https://oss-cn-hangzhou.aliyuncs.com",
		region: "cn-hangzhou",
		bucket: "cogm-bucket",
		forcePathStyle: false,
		keyPrefix: "prod/assets/",
		accessKeyId: "AKIA_TEST_KEY",
		secretAccessKey: "SECRET_TEST_VALUE",
		downloadBaseUrl: "https://cdn.example.com/static",
		accessMode: "public" as const,
		signedUrlTtlSeconds: 600,
	};

	test("normalizes key prefixes and joins object keys safely", () => {
		expect(normalizeKeyPrefix("")).toBe("");
		expect(normalizeKeyPrefix(" /cogm/prod/ ")).toBe("cogm/prod/");
		expect(joinObjectKey("cogm", "media", "abc.png")).toBe(
			"cogm/media/abc.png",
		);
		expect(extensionForMimeType("image/webp", "a.bin")).toBe(".webp");
		expect(extensionForMimeType("application/octet-stream", "bg.PNG")).toBe(
			".png",
		);
	});

	test("builds public custom-domain URLs and virtual-host presigned PUT URLs using publicUploadEndpoint", () => {
		const client = new S3CompatibleClient(baseConfig);
		expect(client.buildPublicUrl("prod/assets/media/pic.png")).toBe(
			"https://cdn.example.com/static/prod/assets/media/pic.png",
		);
		expect(client.buildPublicPrefixUrl("prod/assets/themes/a.b/1.0.0")).toBe(
			"https://cdn.example.com/static/prod/assets/themes/a.b/1.0.0/",
		);

		const presignedPut = client.presignPutUrl("prod/assets/media/pic.png", {
			contentType: "image/png",
			expiresInSeconds: 300,
			usePublicUploadEndpoint: true,
			now: new Date("2026-11-24T00:00:00.000Z"),
		});
		const parsed = new URL(presignedPut.url);
		expect(parsed.host).toBe("cogm-bucket.oss-cn-hangzhou.aliyuncs.com");
		expect(parsed.pathname).toBe("/prod/assets/media/pic.png");
		expect(parsed.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
		expect(parsed.searchParams.get("X-Amz-Credential")).toBe(
			"AKIA_TEST_KEY/20261124/cn-hangzhou/s3/aws4_request",
		);
		expect(parsed.searchParams.get("X-Amz-SignedHeaders")).toBe(
			"content-type;host",
		);
		expect(parsed.searchParams.get("X-Amz-Expires")).toBe("300");
		expect(parsed.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
		expect(presignedPut.headers).toEqual({ "Content-Type": "image/png" });
	});

	test("supports forcePathStyle endpoints and custom-domain presigned GET URLs", () => {
		const client = new S3CompatibleClient({
			...baseConfig,
			endpoint: "http://127.0.0.1:9000",
			publicUploadEndpoint: "",
			forcePathStyle: true,
			accessMode: "private",
		});

		const put = client.presignPutUrl("media/a b.png", {
			contentType: "image/png",
			usePublicUploadEndpoint: true,
			now: new Date("2026-11-24T00:00:00.000Z"),
		});
		const putUrl = new URL(put.url);
		expect(putUrl.origin).toBe("http://127.0.0.1:9000");
		expect(putUrl.pathname).toBe("/cogm-bucket/media/a%20b.png");

		const get = client.presignGetUrl("media/a b.png", {
			expiresInSeconds: 120,
			useCustomDownloadDomain: true,
			now: new Date("2026-11-24T00:00:00.000Z"),
		});
		const getUrl = new URL(get);
		expect(getUrl.origin).toBe("https://cdn.example.com");
		expect(getUrl.pathname).toBe("/static/media/a%20b.png");
		expect(getUrl.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
		expect(getUrl.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
	});

	test("detectFileMimeTypeFromRanges supports tail moov M4A and rejects video MP4", () => {
		const makeBox = (type: string, body: Uint8Array) => {
			const out = new Uint8Array(8 + body.length);
			new DataView(out.buffer).setUint32(0, out.length, false);
			out.set(new TextEncoder().encode(type), 4);
			out.set(body, 8);
			return out;
		};
		const ftyp = new Uint8Array(16);
		new DataView(ftyp.buffer).setUint32(0, 16, false);
		ftyp.set(new TextEncoder().encode("ftypM4A "), 4);

		// Head only contains ftyp + truncated mdat (no moov yet)
		const mdatHead = new Uint8Array(100);
		new DataView(mdatHead.buffer).setUint32(0, 200_000, false);
		mdatHead.set(new TextEncoder().encode("mdat"), 4);
		const head = new Uint8Array(ftyp.length + mdatHead.length);
		head.set(ftyp, 0);
		head.set(mdatHead, ftyp.length);

		const soundHdlr = new Uint8Array(24);
		soundHdlr.set(new TextEncoder().encode("soun"), 8);
		const audioTail = makeBox(
			"moov",
			makeBox("trak", makeBox("mdia", makeBox("hdlr", soundHdlr))),
		);
		expect(detectFileMimeTypeFromRanges(head, audioTail)).toBe("audio/mp4");

		const videoHdlr = new Uint8Array(24);
		videoHdlr.set(new TextEncoder().encode("vide"), 8);
		const videoTail = makeBox(
			"moov",
			makeBox("trak", makeBox("mdia", makeBox("hdlr", videoHdlr))),
		);
		expect(detectFileMimeTypeFromRanges(head, videoTail)).toBeNull();
	});
});
