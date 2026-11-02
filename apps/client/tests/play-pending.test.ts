import { beforeEach, describe, expect, test } from "bun:test";
import type { ChatMessageDto } from "@cogm/shared";
import { usePlayStore } from "../src/stores/play-store";

const pending: ChatMessageDto = {
  id: "m1",
  sessionId: "s1",
  senderId: "p1",
  senderType: "player",
  characterId: "c1",
  characterName: "调查员",
  channel: "roleplay",
  content: "等待审查的发言",
  expressionKey: null,
  queueOrder: 1,
  eventId: null,
  presentedAt: null,
  createdAt: 1_700_000_000_000,
  rejectionReason: null,
};

function receive(message: unknown): void {
  usePlayStore.getState().applyMessage(message as never);
}

beforeEach(() => {
  usePlayStore.getState().reset();
});

describe("player pending review state", () => {
  test("marks the author's queued message as pending", () => {
    receive({ protocolVersion: 1, type: "chat:pending", payload: { message: pending } });

    const message = usePlayStore.getState().messages.find((item) => item.id === "m1");
    expect(message?.pending).toBe(true);
    expect(message?.body).toBe("等待审查的发言");
  });

  test("replaces the pending entry when the GM releases it", () => {
    receive({ protocolVersion: 1, type: "chat:pending", payload: { message: pending } });
    receive({
      protocolVersion: 1,
      eventId: 10,
      type: "chat:message",
      occurredAt: 1_700_000_000_100,
      payload: { message: { ...pending, eventId: 10, presentedAt: 1_700_000_000_100 } },
    });

    const matches = usePlayStore.getState().messages.filter((item) => item.id === "m1");
    expect(matches.length).toBe(1);
    expect(matches[0]?.pending).toBeUndefined();
    expect(matches[0]?.body).toBe("等待审查的发言");
  });

  test("keeps the rejection reason on the message", () => {
    receive({ protocolVersion: 1, type: "chat:pending", payload: { message: pending } });
    receive({
      protocolVersion: 1,
      type: "chat:rejected",
      payload: { messageId: "m1", reason: "与当前场景不符" },
    });

    const message = usePlayStore.getState().messages.find((item) => item.id === "m1");
    expect(message?.pending).toBe(false);
    expect(message?.rejected).toBe(true);
    expect(message?.rejectionReason).toBe("与当前场景不符");
  });
});
