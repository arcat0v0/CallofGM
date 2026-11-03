import { beforeEach, describe, expect, test } from "bun:test";
import type { GrantedHandoutDto } from "@cogm/shared";
import { render } from "@testing-library/react";
import { HandoutLibrary } from "../src/features/session-live/handout-library";
import { usePlayStore } from "../src/stores/play-store";

const handout: GrantedHandoutDto = {
	grantId: "g1",
	handout: {
		id: "h1",
		title: "旧照片",
		content: "背面有一行褪色的字。",
		imageAssetId: null,
	},
	isPublic: true,
	grantedAt: 1_700_000_000_000,
	read: false,
};

beforeEach(() => {
	usePlayStore.getState().reset();
	usePlayStore.setState({ handouts: [handout] });
});

describe("handout library", () => {
	test("marks the displayed handout as read", () => {
		render(
			<HandoutLibrary
				handouts={[handout]}
				open
				onOpenChange={() => undefined}
			/>,
		);

		expect(usePlayStore.getState().handouts[0]?.read).toBe(true);
	});
});
