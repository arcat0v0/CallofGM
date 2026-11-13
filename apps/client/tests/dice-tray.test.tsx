import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { toast } from "sonner";

const sent: Array<{ type: string; payload: unknown }> = [];
let commandResult: string | null = "cmd-1";

mock.module("@/lib/session-socket", () => ({
	sendSessionCommand: (type: string, payload: unknown) => {
		sent.push({ type, payload });
		return commandResult;
	},
}));

const { DiceTray } = await import("../src/features/session-live/dice-tray");
const { Toaster } = await import("../src/components/ui/sonner");
const { usePlayStore } = await import("../src/stores/play-store");

const commandToast = {
	id: "session-command-error",
	position: "bottom-left",
	closeButton: true,
} as const;

function renderTray(
	withToaster = false,
	options: { gm?: boolean; characterId?: string | null } = {},
) {
	const tray = render(
		<DiceTray
			characterId={
				options.characterId === undefined ? "c1" : options.characterId
			}
			gm={options.gm ?? false}
		/>,
	);
	const toaster = withToaster ? render(<Toaster />) : null;
	return { tray, toaster };
}

describe("DiceTray local failure toasts", () => {
	beforeEach(() => {
		sent.length = 0;
		commandResult = "cmd-1";
		for (const item of toast.getToasts()) {
			toast.dismiss(item.id);
		}
		usePlayStore.getState().reset();
	});

	test("repeated local failures and distinct command rejections coalesce into one closable bottom-left toast", async () => {
		const error = spyOn(toast, "error");
		const { tray, toaster } = renderTray(true);
		try {
			commandResult = null;
			fireEvent.click(tray.getByRole("button", { name: "掷骰" }));
			fireEvent.click(tray.getByRole("button", { name: "掷骰" }));
			expect(error).toHaveBeenCalledTimes(2);
			for (const call of error.mock.calls) {
				expect(call[0]).toBe("尚未连接到团");
				expect(call[1]).toEqual(commandToast);
			}

			fireEvent.click(tray.getByRole("radio", { name: "鉴定" }));
			commandResult = "cmd-check";
			const checkButton = tray.getAllByRole("button", { name: "鉴定" }).at(-1);
			expect(checkButton).toBeDefined();
			if (checkButton) {
				fireEvent.click(checkButton);
			}
			expect(sent).toHaveLength(3);
			expect(sent[2]?.type).toBe("check:perform");

			usePlayStore.getState().applyMessage({
				protocolVersion: 1,
				commandId: "cmd-check",
				type: "command:rejected",
				payload: { code: "RATE_LIMITED", message: "Too many commands" },
			});
			expect(error).toHaveBeenCalledTimes(3);
			expect(error.mock.calls[2]?.[0]).toBe("操作太频繁，请稍后再试");
			expect(error.mock.calls[2]?.[1]).toEqual(commandToast);

			await waitFor(() => {
				expect(
					toaster?.container.querySelectorAll("[data-sonner-toast]"),
				).toHaveLength(1);
			});
			expect(toast.getToasts()).toHaveLength(1);
			expect(toast.getToasts()[0]).toMatchObject({
				...commandToast,
				title: "操作太频繁，请稍后再试",
			});
			expect(
				toaster?.container.querySelector("[data-close-button]"),
			).not.toBeNull();
			expect(
				toaster?.container.querySelector("[data-x-position='left']"),
			).not.toBeNull();
			expect(
				toaster?.container.querySelector("[data-y-position='bottom']"),
			).not.toBeNull();
		} finally {
			error.mockRestore();
		}
	});

	test("local dice failures do not overwrite command rejection recovery state", () => {
		const { tray } = renderTray();
		commandResult = null;
		fireEvent.click(tray.getByRole("button", { name: "掷骰" }));

		usePlayStore.getState().applyMessage({
			protocolVersion: 1,
			commandId: "cmd-1",
			type: "command:rejected",
			payload: { code: "RATE_LIMITED", message: "Too many commands" },
		});

		expect(usePlayStore.getState().lastRejection).toEqual({
			commandId: "cmd-1",
			message: "操作太频繁，请稍后再试",
		});
		expect(toast.getToasts()).toHaveLength(1);
		expect(toast.getToasts()[0]).toMatchObject({
			...commandToast,
			title: "操作太频繁，请稍后再试",
		});
	});
});
