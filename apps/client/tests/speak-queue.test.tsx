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
] as const;

const [observerRow, pcRow] = rows;

describe("speak queue readability", () => {
	test("every queue action carries an accessible label", () => {
		const html = renderToStaticMarkup(
			<div>
				{rows.map((item) => (
					<QueueRow
						key={item.id}
						item={item}
						expanded
						onToggle={() => {}}
						onReorder={() => {}}
					/>
				))}
			</div>,
		);
		expect(html).toContain("放行发言");
		expect(html).toContain('aria-label="放行「观战 · b4e0d0」的发言"');
		expect(html).toContain('aria-label="拒绝「观战 · b4e0d0」的发言"');
		expect(html).toContain('title="拒绝发言"');
		expect(html).toContain('aria-label="拖动排序「观战 · b4e0d0」的发言"');
		expect(html).toContain('title="拖动排序；Alt + ↑/↓ 调整"');
	});

	test("expanded rows identify observers and keep the full message body untruncated", () => {
		const html = renderToStaticMarkup(
			<QueueRow
				item={observerRow}
				expanded
				onToggle={() => {}}
				onReorder={() => {}}
			/>,
		);
		expect(html).toContain("观战 · b4e0d0");
		expect(html).toContain("（把手电筒举高，照向楼梯井）我上去看看。");
		expect(html).toContain("whitespace-pre-wrap break-words");
	});

	test("collapsed rows keep names and hide the message body", () => {
		const html = renderToStaticMarkup(
			<QueueRow
				item={pcRow}
				expanded={false}
				onToggle={() => {}}
				onReorder={() => {}}
			/>,
		);
		expect(html).toContain("陈默");
		expect(html).toContain("角色发言 · 默认");
		expect(html).not.toContain("第二句话测试");
	});
});
