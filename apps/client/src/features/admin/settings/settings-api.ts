import type {
	AdminSiteSettingsResponse,
	BrowserStorageProbeDto,
	ResetSiteSettingsRequest,
	S3ConfigInput,
	StorageCheckItemDto,
	StorageMigrationStatusDto,
	TestStorageConnectionResponse,
	UpdateSiteSettingsRequest,
} from "@cogm/shared";
import { t } from "@/i18n";
import { api } from "@/lib/api";

export async function fetchAdminSettings(): Promise<AdminSiteSettingsResponse> {
	return api<AdminSiteSettingsResponse>("/admin/settings", {
		cache: "no-store",
	});
}

export async function updateAdminSettings(
	payload: UpdateSiteSettingsRequest,
): Promise<AdminSiteSettingsResponse> {
	return api<AdminSiteSettingsResponse>("/admin/settings", {
		method: "PUT",
		body: JSON.stringify(payload),
	});
}

export async function resetAdminSettings(
	section: ResetSiteSettingsRequest["section"],
): Promise<AdminSiteSettingsResponse> {
	return api<AdminSiteSettingsResponse>("/admin/settings/reset", {
		method: "POST",
		body: JSON.stringify({ section }),
	});
}

export async function testStorageConnection(
	s3?: S3ConfigInput,
): Promise<TestStorageConnectionResponse> {
	return api<TestStorageConnectionResponse>("/admin/settings/storage/test", {
		method: "POST",
		body: JSON.stringify(s3 ? { s3 } : {}),
	});
}

export async function cleanupStorageProbe(probeToken: string): Promise<void> {
	await api("/admin/settings/storage/test-cleanup", {
		method: "POST",
		body: JSON.stringify({ probeToken }),
	});
}

export async function fetchStorageMigrationStatus(): Promise<StorageMigrationStatusDto> {
	return api<StorageMigrationStatusDto>("/admin/settings/storage/migrate", {
		cache: "no-store",
	});
}

export async function startStorageMigration(): Promise<StorageMigrationStatusDto> {
	return api<StorageMigrationStatusDto>("/admin/settings/storage/migrate", {
		method: "POST",
	});
}

function extractOriginSafely(rawUrl: string): string {
	try {
		return new URL(rawUrl).origin;
	} catch {
		return rawUrl;
	}
}

function extractS3Code(body: string): string | null {
	const match = body.match(/<Code>([^<]+)<\/Code>/i);
	return match?.[1]?.trim() || null;
}

export async function runBrowserStorageProbe(
	probe: BrowserStorageProbeDto,
): Promise<{
	browserPut: StorageCheckItemDto;
	browserGet: StorageCheckItemDto;
}> {
	const pageOrigin =
		typeof window !== "undefined" ? window.location.origin : "unknown";
	const uploadOrigin = extractOriginSafely(probe.uploadUrl);
	const downloadOrigin = extractOriginSafely(probe.downloadUrl);

	let browserPut: StorageCheckItemDto = { ok: false };
	let browserGet: StorageCheckItemDto = {
		ok: false,
		error: t("admin.settings.storage.check.browserGetSkipped"),
	};
	const putStart = Date.now();
	try {
		const putRes = await fetch(probe.uploadUrl, {
			method: "PUT",
			headers: probe.headers,
			body: probe.probeContent,
			credentials: "omit",
		});
		if (!putRes.ok) {
			const bodyText = await putRes.text().catch(() => "");
			const s3Code = extractS3Code(bodyText);
			browserPut = {
				ok: false,
				status: putRes.status,
				url: uploadOrigin,
				latencyMs: Date.now() - putStart,
				error: s3Code
					? `HTTP ${putRes.status} (${s3Code})`
					: `HTTP ${putRes.status}`,
			};
		} else {
			browserPut = {
				ok: true,
				status: putRes.status,
				url: uploadOrigin,
				latencyMs: Date.now() - putStart,
			};
		}
	} catch (error) {
		const rawMessage = error instanceof Error ? error.message : String(error);
		browserPut = {
			ok: false,
			url: uploadOrigin,
			latencyMs: Date.now() - putStart,
			error: `${rawMessage} · ${t(
				"admin.settings.storage.check.browserNetworkHint",
				{
					origin: pageOrigin,
					target: uploadOrigin,
				},
			)}`,
		};
	}

	if (browserPut.ok) {
		const getStart = Date.now();
		try {
			const getRes = await fetch(probe.downloadUrl, {
				method: "GET",
				credentials: "omit",
			});
			const text = await getRes.text().catch(() => "");
			if (!getRes.ok) {
				browserGet = {
					ok: false,
					status: getRes.status,
					url: downloadOrigin,
					latencyMs: Date.now() - getStart,
					error: `HTTP ${getRes.status}`,
				};
			} else if (text !== probe.probeContent) {
				browserGet = {
					ok: false,
					status: getRes.status,
					url: downloadOrigin,
					latencyMs: Date.now() - getStart,
					error: "Response mismatch",
				};
			} else {
				browserGet = {
					ok: true,
					status: getRes.status,
					url: downloadOrigin,
					latencyMs: Date.now() - getStart,
				};
			}
		} catch (error) {
			const rawMessage = error instanceof Error ? error.message : String(error);
			browserGet = {
				ok: false,
				url: downloadOrigin,
				latencyMs: Date.now() - getStart,
				error: `${rawMessage} · ${t(
					"admin.settings.storage.check.browserNetworkHint",
					{
						origin: pageOrigin,
						target: downloadOrigin,
					},
				)}`,
			};
		}
	}

	await cleanupStorageProbe(probe.probeToken).catch(() => undefined);
	return { browserPut, browserGet };
}
