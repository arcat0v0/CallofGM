import { describe, expect, test } from "bun:test";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { renderToStaticMarkup } from "react-dom/server";
import { AlertDialogAction } from "../src/components/ui/alert-dialog";

describe("AlertDialogAction semantics", () => {
	test("preserves data-slot and button variant classes", () => {
		let clicked = false;
		const html = renderToStaticMarkup(
			<AlertDialogPrimitive.Root open>
				<AlertDialogPrimitive.Content>
					<AlertDialogAction
						onClick={() => {
							clicked = true;
						}}
						variant="danger"
					>
						确认
					</AlertDialogAction>
				</AlertDialogPrimitive.Content>
			</AlertDialogPrimitive.Root>,
		);
		expect(html).toContain('data-slot="alert-dialog-action"');
		expect(html).toContain("确认");
		expect(html).toContain("bg-danger");
	});
});
