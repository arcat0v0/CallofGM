import { beforeEach, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { GmSessionSettingsDialog } from "../src/features/gm-console/gm-session-settings-dialog";
import { usePlayStore } from "../src/stores/play-store";

beforeEach(() => {
	usePlayStore.getState().reset();
});

test("exposes the session rule settings", () => {
	const view = render(
		<GmSessionSettingsDialog open onOpenChange={() => undefined} />,
	);
	expect(view.getByText("允许花费幸运改骰")).toBeTruthy();
	expect(view.getByText("大成功 / 大失败判定")).toBeTruthy();
	expect(view.getByText("规则书标准")).toBeTruthy();
});
