type ChatChannel = "all" | "ic" | "ooc";

function filterChatMessages<T extends { tone?: "ic" | "ooc" }>(
  messages: T[],
  channel: ChatChannel,
): T[] {
  if (channel === "ic") {
    return messages.filter((message) => message.tone !== "ooc");
  }
  if (channel === "ooc") {
    return messages.filter((message) => message.tone === "ooc");
  }
  return messages;
}

export { filterChatMessages };
export type { ChatChannel };
