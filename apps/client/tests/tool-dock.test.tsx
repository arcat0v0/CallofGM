import { beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { PlayerActionDock } from "../src/features/play/player-action-dock";
import { usePlayStore } from "../src/stores/play-store";

beforeEach(() => {
  usePlayStore.getState().reset();
  usePlayStore.setState({
    phase: "free_discussion",
    status: "active",
    viewer: { isGm: false, seatRole: "pc" },
  });
});

describe("player action dock", () => {
  test("opens the dice panel from the shared dock button", async () => {
    const { findByRole, getByRole } = render(<PlayerActionDock variant="desktop" />);

    fireEvent.click(getByRole("button", { name: "掷骰与鉴定" }));

    expect(await findByRole("radio", { name: "骰点" })).toBeTruthy();
  });
});
