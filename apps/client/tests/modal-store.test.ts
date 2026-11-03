import { beforeEach, describe, expect, test } from "bun:test";
import {
	activeBlockingModal,
	BlockingModalPriority,
	useModalStore,
} from "../src/stores/modal-store";

describe("blocking modal coordination", () => {
	beforeEach(() => {
		useModalStore.getState().reset();
	});

	test("reports no active modal when everything is closed", () => {
		expect(useModalStore.getState().open).toEqual({
			end: false,
			check: false,
			handout: false,
			library: false,
			sheet: false,
		});
		expect(activeBlockingModal(useModalStore.getState().open)).toBeNull();
	});

	test("the end notice outranks queued handouts and check requests", () => {
		const { setModalOpen } = useModalStore.getState();
		setModalOpen("handout", true);
		setModalOpen("check", true);
		setModalOpen("end", true);
		expect(activeBlockingModal(useModalStore.getState().open)).toBe("end");
	});

	test("the next queued prompt becomes active once the end notice closes", () => {
		const { setModalOpen } = useModalStore.getState();
		setModalOpen("end", true);
		setModalOpen("handout", true);
		expect(activeBlockingModal(useModalStore.getState().open)).toBe("end");

		setModalOpen("end", false);
		expect(activeBlockingModal(useModalStore.getState().open)).toBe("handout");

		setModalOpen("handout", false);
		expect(activeBlockingModal(useModalStore.getState().open)).toBeNull();
	});

	test("the handout library cannot open on top of the unread prompt", () => {
		const { setModalOpen } = useModalStore.getState();
		setModalOpen("handout", true);
		setModalOpen("library", true);
		expect(activeBlockingModal(useModalStore.getState().open)).toBe("handout");

		setModalOpen("handout", false);
		expect(activeBlockingModal(useModalStore.getState().open)).toBe("library");
	});

	test("the character sheet never wins over the prompt or library", () => {
		const { setModalOpen } = useModalStore.getState();
		setModalOpen("sheet", true);
		setModalOpen("library", true);
		expect(activeBlockingModal(useModalStore.getState().open)).toBe("library");
		expect(BlockingModalPriority.sheet).toBeLessThan(
			BlockingModalPriority.library,
		);
	});

	test("closing an already closed modal keeps the store stable", () => {
		const { setModalOpen } = useModalStore.getState();
		const before = useModalStore.getState().open;
		setModalOpen("end", false);
		expect(useModalStore.getState().open).toBe(before);
	});
});
