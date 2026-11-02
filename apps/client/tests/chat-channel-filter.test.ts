import { describe, expect, test } from "bun:test";
import { filterChatMessages } from "../src/features/chat/channel-filter";

const messages = [
  { id: "ic", tone: "ic" as const },
  { id: "ooc", tone: "ooc" as const },
  { id: "unset" },
];

describe("chat channel filter", () => {
  test("keeps every message in the all channel", () => {
    expect(filterChatMessages(messages, "all")).toHaveLength(3);
  });

  test("keeps roleplay messages and legacy tone-less messages in the ic channel", () => {
    expect(filterChatMessages(messages, "ic").map((message) => message.id)).toEqual(["ic", "unset"]);
  });

  test("keeps only ooc messages in the ooc channel", () => {
    expect(filterChatMessages(messages, "ooc").map((message) => message.id)).toEqual(["ooc"]);
  });
});
