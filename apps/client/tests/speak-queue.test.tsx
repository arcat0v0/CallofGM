import { describe, expect, test } from "bun:test";
import type { ChatMessageDto } from "@cogm/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { QueueRow } from "../src/features/gm-console/gm-panel-stage";

function queued(overrides: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id: "q1",
    sessionId: "s1",
    senderId: "b4e0d065-9ec6-4924-986a-839796f688ce",
    senderType: "player",
    characterId: null,
    characterName: null,
    channel: "ooc",
    content: "（把手电筒举高，照向楼梯井）我上去看看。",
    expressionKey: null,
    queueOrder: 1,
    eventId: null,
    presentedAt: null,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

const rows = [
  queued(),
  queued({
    id: "q2",
    senderId: "9badfa2d-544b-44ec-bde4-06c639391e54",
    characterId: "c2",
    characterName: "陈默",
    channel: "roleplay",
    content: "第二句话测试",
    queueOrder: 2,
  }),
];

describe("speak queue readability", () => {
  test("every queue action carries a visible text label", () => {
    const html = renderToStaticMarkup(
      <div>
        {rows.map((item, index) => (
          <QueueRow
            key={item.id}
            item={item}
            index={index}
            total={rows.length}
            onReorder={() => {}}
          />
        ))}
      </div>,
    );
    for (const label of ["上移", "下移", "放行", "丢弃"]) {
      expect(html).toContain(`>${label}<`);
      expect(html).toContain(`title="${label}"`);
    }
  });

  test("queue rows identify observers and keep the full message body untruncated", () => {
    const html = renderToStaticMarkup(
      <QueueRow item={rows[0]} index={0} total={2} onReorder={() => {}} />,
    );
    expect(html).toContain("观战 · b4e0d0");
    expect(html).toContain("（把手电筒举高，照向楼梯井）我上去看看。");
    expect(html).toContain("text-body-small whitespace-pre-wrap break-words");
    expect(html).toContain('aria-label="放行「观战 · b4e0d0」的发言"');
  });

  test("PC names stay intact in the queue", () => {
    const html = renderToStaticMarkup(
      <QueueRow item={rows[1]} index={1} total={2} onReorder={() => {}} />,
    );
    expect(html).toContain("陈默");
    expect(html).toContain("第二句话测试");
  });
});
