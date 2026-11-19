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
				assertTrustedOrigin(request, corsOriginsFor(container.env));
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
		.get("/api/v1/media/:id", async ({ params, actor }) => {
			const { data, mimeType, size } = await readUseCase.execute(
				actor,
				params.id,
			);

			return new Response(data, {
				headers: {
					"Content-Type": mimeType,
					"Content-Length": size.toString(),
				},
			});
		});
}
