import { type VersionResponse, VersionResponseSchema } from "@cogm/shared";
import { api } from "./api";

export async function loadVersionResponse(): Promise<VersionResponse> {
	return VersionResponseSchema.parse(
		await api<unknown>("/api/version", { cache: "no-store" }),
	);
}
