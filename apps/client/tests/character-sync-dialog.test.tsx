import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { CharacterSyncDiffDto } from "@cogm/shared";
import {
	cleanup,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react";
import { CharacterSyncDialog } from "../src/features/gm-console/character-sync-dialog";

const preview: CharacterSyncDiffDto = {
	characterId: "character-1",
	sessionId: "session-1",
	sessionName: "雾中的灯塔",
	currentName: "调查员",
	currentBackground: "新的背景",
	currentSheetJson: '{"attributes":{}}',
	baseName: "调查员",
	baseBackground: "旧背景",
	baseSheetJson: '{"attributes":{}}',
	currentVersion: 4,
	baseVersion: 2,
	staleReview: true,
	statePreview: {
		current: { hp: 4, maxHp: 10, mp: 3, maxMp: 12, san: 30, maxSan: 99 },
		next: { hp: 9, maxHp: 16, mp: 4, maxMp: 14, san: 14, maxSan: 14 },
	},
};

describe("character sync dialog", () => {
	beforeEach(() => {
		cleanup();
		document.body.innerHTML = "";
		if (!Element.prototype.hasPointerCapture) {
			Element.prototype.hasPointerCapture = () => false;
		}
		if (!Element.prototype.setPointerCapture) {
			Element.prototype.setPointerCapture = () => undefined;
		}
		if (!Element.prototype.releasePointerCapture) {
			Element.prototype.releasePointerCapture = () => undefined;
		}
	});

	afterEach(() => {
		cleanup();
		document.body.innerHTML = "";
	});

	test("previews differences, state limits and applies the versioned sync", async () => {
		const calls: Array<{ url: string; init: RequestInit }> = [];
		const originalFetch = globalThis.fetch;
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: (async (url: string | URL, init?: RequestInit) => {
				const target = String(url);
				calls.push({ url: target, init: init ?? {} });
				const body = target.includes("/sync-preview")
					? preview
					: { applied: ["name", "background", "sheet"], syncedAt: 1 };
				return new Response(JSON.stringify(body), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}) as typeof fetch,
		});
		try {
			render(
				<CharacterSyncDialog
					open
					onOpenChange={() => undefined}
					sessionId="session-1"
					characterId="character-1"
				/>,
			);
			await waitFor(() =>
				expect(within(document.body).getByText("雾中的灯塔")).toBeTruthy(),
			);
			expect(
				within(document.body).getByText(/审核记录可能已过期/),
			).toBeTruthy();
			expect(within(document.body).getByText("3/12")).toBeTruthy();
			expect(within(document.body).getByText("4/14")).toBeTruthy();
			fireEvent.click(
				within(document.body).getByRole("button", { name: "确认同步" }),
			);
			await waitFor(() =>
				expect(
					calls.some(
						(call) =>
							call.url.includes("/sync") && !call.url.includes("sync-preview"),
					),
				).toBe(true),
			);
			const apply = calls.find(
				(call) =>
					call.url.includes("/sync") && !call.url.includes("sync-preview"),
			);
			const payload = JSON.parse(String(apply?.init.body)) as {
				fields: string[];
				expectedVersion: number;
			};
			expect(payload.fields).toEqual(["name", "background", "sheet"]);
			expect(payload.expectedVersion).toBe(4);
		} finally {
			Object.defineProperty(globalThis, "fetch", {
				configurable: true,
				writable: true,
				value: originalFetch,
			});
		}
	});
});
