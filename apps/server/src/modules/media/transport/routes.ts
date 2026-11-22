import { MediaAssetDto, MediaPurpose } from "@cogm/shared";
import { Elysia, t } from "elysia";
import type { Container } from "@/bootstrap/container";
import { corsOriginsFor } from "@/config/env";
import { validationFailed } from "@/platform/errors/validation";
import { assertTrustedOrigin } from "@/platform/security/origin";
import { clientIp } from "@/platform/security/request-ip";
import { ReadMediaUseCase } from "../application/read-media";
import {
	requireMediaUploader,
	UploadMediaUseCase,
} from "../application/upload-media";

export function createMediaRoutes(container: Container) {
	const uploadUseCase = new UploadMediaUseCase(
		container.mediaRepo,
		container.mediaStorage,
		container.idGenerator,
		container.clock,
	);

	const readUseCase = new ReadMediaUseCase(
		container.mediaRepo,
		container.mediaStorage,
	);

	return new Elysia()
		.use(container.authPlugin)
		.post(
			"/api/v1/media/upload",
			async ({ body, actor, request, server }) => {
				const ownerId = requireMediaUploader(actor);
				assertTrustedOrigin(request, corsOriginsFor(container.env), container.env.TRUST_PROXY);
				container.httpLimits.uploadRateLimiter.assert(
					clientIp(request, server, container.env.TRUST_PROXY),
				);
				const file = body.file as Blob;
				const parsedPurpose = MediaPurpose.safeParse(body.purpose ?? "general");
				if (!parsedPurpose.success) {
					throw validationFailed(parsedPurpose.error);
				}
				const purpose = parsedPurpose.data;
				const filename = body.filename || "file";

				const asset = await uploadUseCase.execute({
					ownerId,
					blob: file,
					filename,
					purpose,
				});

				return MediaAssetDto.parse(asset);
			},
			{
				body: t.Object({
					file: t.File(),
					purpose: t.Optional(t.String()),
					filename: t.Optional(t.String()),
				}),
			},
		)
		.get("/api/v1/media/:id", async ({ params, actor, request }) => {
			const { data, mimeType } = await readUseCase.execute(actor, params.id);
			const total = data.byteLength;
			const baseHeaders = {
				"Content-Type": mimeType,
				"Accept-Ranges": "bytes",
			};
			const range = parseByteRange(request.headers.get("range"), total);
			if (range === "unsatisfiable") {
				return new Response(null, {
					status: 416,
					headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
				});
			}
			if (range) {
				const chunk = data.subarray(range.start, range.end + 1);
				return new Response(chunk, {
					status: 206,
					headers: {
						...baseHeaders,
						"Content-Length": chunk.byteLength.toString(),
						"Content-Range": `bytes ${range.start}-${range.end}/${total}`,
					},
				});
			}
			return new Response(data, {
				headers: { ...baseHeaders, "Content-Length": total.toString() },
			});
		});
}

/**
 * 解析单段 `Range: bytes=a-b`（浏览器 <audio> 跳转与续传用）。
 * 没有或格式不认识时返回 null，按整文件响应；越界返回 "unsatisfiable"。
 */
function parseByteRange(
	header: string | null,
	total: number,
): { start: number; end: number } | "unsatisfiable" | null {
	const match = header?.match(/^bytes=(\d*)-(\d*)$/);
	if (!match || (match[1] === "" && match[2] === "")) {
		return null;
	}
	if (match[1] === "") {
		const suffix = Number(match[2]);
		if (suffix === 0) {
			return "unsatisfiable";
		}
		return { start: Math.max(0, total - suffix), end: total - 1 };
	}
	const start = Number(match[1]);
	if (start >= total) {
		return "unsatisfiable";
	}
	const end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
	return end < start ? "unsatisfiable" : { start, end };
}
