import { describe, expect, test, beforeEach } from "bun:test";
import { usePlayStore } from "../src/stores/play-store";

describe("play-store draft-loss and command rejection tracking", () => {
  beforeEach(() => {
    usePlayStore.getState().reset();
  });

  test("command:rejected records lastRejection with commandId and message", () => {
    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-xyz-123",
      type: "command:rejected",
      payload: { code: "VALIDATION_FAILED", message: "Expression portrait not found" },
    });

    const rejection = usePlayStore.getState().lastRejection;
    expect(rejection).not.toBeNull();
    expect(rejection?.commandId).toBe("cmd-xyz-123");
    expect(rejection?.message).toBe("Expression portrait not found");
  });

  test("reset clears lastRejection", () => {
    usePlayStore.getState().applyMessage({
      protocolVersion: 1,
      commandId: "cmd-xyz-123",
      type: "command:rejected",
      payload: { message: "error" },
    });
    expect(usePlayStore.getState().lastRejection).not.toBeNull();
    usePlayStore.getState().reset();
    expect(usePlayStore.getState().lastRejection).toBeNull();
  });
});
