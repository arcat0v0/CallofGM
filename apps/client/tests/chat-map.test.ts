import { describe, expect, test } from "bun:test";
import type { ChatMessageDto } from "@cogm/shared";
import {
  mapActivityEvent,
  mapChatMessage,
  obSpeakerLabel,
  speakerNameOf,
  speakerRoleLabelOf,
} from "../src/lib/chat-map";

function dto(overrides: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id: "m1",
    sessionId: "s1",
    senderId: "b4e0d065-9ec6-4924-986a-839796f688ce",
    senderType: "player",
    characterId: null,
    characterName: null,
    channel: "ooc",
    content: "（举着手电筒踏上台阶）",
    expressionKey: null,
    queueOrder: 0,
    eventId: 1,
    presentedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("chat speaker identity", () => {
  test("observers are labelled by a stable short player id", () => {
    expect(obSpeakerLabel("b4e0d065-9ec6-4924-986a-839796f688ce")).toBe(
      "观战 · b4e0d0",
    );
    expect(obSpeakerLabel(null)).toBe("观战");
  });

  test("an observer message never renders as the generic player label", () => {
    const message = dto();
    expect(speakerNameOf(message)).toBe("观战 · b4e0d0");
    expect(speakerRoleLabelOf(message)).toBe("观战");
    const mapped = mapChatMessage(message);
    expect(mapped.speakerName).toBe("观战 · b4e0d0");
    expect(mapped.avatarInitials).toBe("观");
  });

  test("two observers with different ids stay distinguishable", () => {
    const first = speakerNameOf(dto());
    const second = speakerNameOf(
      dto({ senderId: "11111111-2222-3333-4444-555555555555" }),
    );
    expect(first).not.toBe(second);
  });

  test("PC names and GM identity are unchanged", () => {
    const pc = dto({
      characterId: "c1",
      characterName: "林雨桐",
      channel: "roleplay",
    });
    expect(speakerNameOf(pc)).toBe("林雨桐");
    expect(speakerRoleLabelOf(pc)).toBe("PC");
    expect(speakerRoleLabelOf({ ...pc, channel: "ooc" })).toBe("场外");

    const gm = dto({
      senderType: "gm",
      senderId: null,
      characterId: null,
      characterName: null,
    });
    expect(speakerNameOf(gm)).toBe("KP");
    expect(speakerRoleLabelOf(gm)).toBe("主持人");
  });

  test("observer dice rolls use the same short id instead of a generic label", () => {
    const event = mapActivityEvent(
      "dice:rolled",
      {
        rollerType: "player",
        rollerId: "b4e0d065-9ec6-4924-986a-839796f688ce",
        result: { expression: "1d100", total: 42 },
      },
      7,
      1_700_000_000_000,
    );
    expect(event?.speakerName).toBe("观战 · b4e0d0");
  });
});

describe("check result clarity", () => {
  function resolved(result: Record<string, unknown>) {
    return mapActivityEvent(
      "check:resolved",
      { characterId: "c1", characterName: "陈默", skillKey: "侦查", hidden: false, result },
      9,
      1_700_000_000_000,
    );
  }

  test("a hard check states the target value and the hard threshold", () => {
    const event = resolved({
      roll: 25,
      targetValue: 70,
      difficulty: "hard",
      outcome: "hard_success",
      success: true,
    });
    expect(event?.body).toBe("侦查 25/70 · 困难成功（目标值 70 · 困难阈值 35）");
  });

  test("a regular check states the target value only", () => {
    const event = resolved({
      roll: 25,
      targetValue: 60,
      difficulty: "regular",
      outcome: "regular_success",
      success: true,
    });
    expect(event?.body).toBe("侦查 25/60 · 常规成功（目标值 60）");
  });

  test("a failed hard check keeps the requested difficulty context", () => {
    const event = resolved({
      roll: 80,
      targetValue: 70,
      difficulty: "hard",
      outcome: "failure",
      success: false,
    });
    expect(event?.body).toBe("侦查 80/70 · 失败（目标值 70 · 困难阈值 35）");
  });
});
