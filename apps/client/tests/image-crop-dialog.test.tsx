import { describe, expect, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ImageCropDialog } from "../src/components/shared/image-crop-dialog";

function Harness({
	onConfirm,
	imageUrl,
}: {
	onConfirm?: (blob: Blob) => void | Promise<void>;
	imageUrl?: string | null;
}) {
	const [open, setOpen] = useState(true);
	return (
		<ImageCropDialog
			open={open}
			onOpenChange={setOpen}
			imageUrl={imageUrl ?? null}
			title="裁剪图片"
			confirmLabel="使用裁剪结果"
			onConfirm={onConfirm ?? (() => {})}
		/>
	);
}

describe("ImageCropDialog", () => {
	test("renders controls and disables confirm without an image", () => {
		const view = render(<Harness />);
		expect(view.getByRole("dialog")).toBeTruthy();
		expect(view.getByRole("heading", { name: "裁剪图片" })).toBeTruthy();
		expect(view.getByRole("slider")).toBeTruthy();
		const confirm = view.getByRole("button", { name: "使用裁剪结果" });
		expect((confirm as HTMLButtonElement).disabled).toBe(true);
		view.unmount();
	});

	test("closes through the close button", async () => {
		const view = render(<Harness />);
		fireEvent.click(view.getByRole("button", { name: "关闭" }));
		await waitFor(() =>
			expect(view.queryByRole("dialog")).toBeNull(),
		);
	});

	test("reset keeps the dialog open without throwing", () => {
		const view = render(<Harness />);
		fireEvent.click(view.getByRole("button", { name: "重置" }));
		expect(view.getByRole("dialog")).toBeTruthy();
		view.unmount();
	});
});
