import { describe, expect, test } from "bun:test";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { renderToStaticMarkup } from "react-dom/server";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
} from "../src/components/ui/alert-dialog";
import { Button } from "../src/components/ui/button";
import { Calendar } from "../src/components/ui/calendar";
import { Checkbox } from "../src/components/ui/checkbox";
import { IconButton } from "../src/components/ui/icon-button";
import { LoadingIndicator } from "../src/components/ui/loading-indicator";
import { CircularProgress, Progress } from "../src/components/ui/progress";
import { Slider } from "../src/components/ui/slider";
import { TextField } from "../src/components/ui/text-field";
import shapes from "../src/lib/expressive-shapes.json";
import { cn } from "../src/lib/utils";

const render = renderToStaticMarkup;

describe("Expressive component semantics", () => {
	test("semantic typography never removes a foreground color", () => {
		for (const family of ["display", "headline", "title", "body", "label"]) {
			for (const size of ["large", "medium", "small"]) {
				for (const suffix of ["", "-emph"]) {
					const typography = `text-${family}-${size}${suffix}`;
					expect(cn("text-accent-foreground", typography)).toContain(
						"text-accent-foreground",
					);
					expect(cn(typography, "text-accent-foreground")).toContain(
						typography,
					);
				}
			}
		}
		expect(cn("text-accent text-danger", "text-title-medium")).not.toContain(
			"text-accent ",
		);
		expect(
			cn("text-label-large text-body-medium", "text-accent"),
		).not.toContain("text-label-large");
	});
	test("filled and icon buttons preserve both contrast and typography after composition", () => {
		expect(render(<Button>确定</Button>)).toContain("text-accent-foreground");
		expect(render(<Button>确定</Button>)).toContain("text-title-medium");
		const icon = render(
			<IconButton size="lg" width="narrow" selected aria-label="暂停">
				Ⅱ
			</IconButton>,
		);
		expect(icon).toContain("text-accent-foreground");
		expect(icon).toContain('data-size="lg"');
		expect(icon).toContain('data-width="narrow"');
	});
	test("dialog actions keep semantic foregrounds through Radix slots", () => {
		const html = render(
			<AlertDialog open>
				<AlertDialogPrimitive.Content>
					<AlertDialogCancel>取消</AlertDialogCancel>
					<AlertDialogAction>确定</AlertDialogAction>
				</AlertDialogPrimitive.Content>
			</AlertDialog>,
		);
		const action = html.match(
			/<button[^>]*data-slot="alert-dialog-action"[^>]*>/,
		)?.[0];
		expect(action).toContain("text-accent-foreground");
		expect(action).toContain("text-label-large");
		expect(action).toContain("bg-accent");
	});
	test("calendar selected dates retain a filled surface and readable foreground", () => {
		const day = new Date(2026, 8, 3);
		const html = render(<Calendar month={day} mode="single" selected={day} />);
		const selected = html.match(
			/<button[^>]*data-selected-single="true"[^>]*>/,
		)?.[0];
		expect(selected).toContain('data-slot="calendar-day"');
		expect(selected).toContain('data-variant="filled"');
		expect(selected).toContain("bg-accent");
		expect(selected).toContain("text-accent-foreground");
	});
	test("progress exposes the value and custom range to assistive technology", () => {
		const html = render(
			<Progress value={25} max={50} aria-label="资源加载" wavy />,
		);
		expect(html).toContain('aria-valuenow="25"');
		expect(html).toContain('aria-valuemax="50"');
		expect(html).toContain("width:50%");
		expect(html).toContain('aria-label="资源加载"');
	});
	test("progress clamps overflow and handles invalid numbers as indeterminate", () => {
		expect(render(<Progress value={120} />)).toContain('aria-valuenow="100"');
		expect(render(<Progress value={-20} />)).toContain('aria-valuenow="0"');
		for (const value of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
			const html = render(<Progress value={value} />);
			expect(html).toContain('data-state="indeterminate"');
			expect(html).not.toContain("aria-valuenow");
			expect(html).not.toContain("NaN");
		}
	});
	test("circular progress exposes the same bounded range", () => {
		expect(render(<CircularProgress value={80} max={40} wavy />)).toContain(
			'aria-valuenow="40"',
		);
		expect(render(<CircularProgress />)).not.toContain("aria-valuenow");
	});
	test("range slider preserves both labelled handles and vertical orientation", () => {
		const html = render(
			<Slider
				defaultValue={[10, 80]}
				thumbLabels={["最小", "最大"]}
				orientation="vertical"
			/>,
		);
		expect(html.match(/role="slider"/g)).toHaveLength(2);
		expect(html).toContain('aria-label="最小"');
		expect(html).toContain('aria-label="最大"');
		expect(html).toContain('aria-orientation="vertical"');
	});
	test("default slider has one handle and waves use unique SVG ids", () => {
		expect(
			render(<Slider aria-label="音量" />).match(/role="slider"/g),
		).toHaveLength(1);
		const html = render(
			<>
				<Progress value={50} wavy />
				<Progress value={20} wavy />
			</>,
		);
		const ids = [...html.matchAll(/<pattern id="([^"]+)"/g)].map(
			(match) => match[1],
		);
		expect(ids).toHaveLength(2);
		expect(new Set(ids).size).toBe(2);
	});
	test("indeterminate checkbox remains mixed and uses the mixed glyph", () => {
		const html = render(
			<Checkbox checked="indeterminate" aria-label="选择角色" />,
		);
		expect(html).toContain('aria-checked="mixed"');
		expect(html).toContain("lucide-minus");
	});
	test("floating field links its label and error without dropping descriptions", () => {
		const html = render(
			<TextField
				id="room"
				label="团名称"
				error="名称不能为空"
				aria-describedby="external-help"
			/>,
		);
		expect(html).toContain('for="room"');
		expect(html).toContain('aria-invalid="true"');
		expect(html).toContain('aria-describedby="external-help room-description"');
		expect(html).toContain('id="room-description"');
	});
	test("button slot composition does not introduce nested buttons", () => {
		const html = render(
			<Button asChild>
				<a href="/gm">进入后台</a>
			</Button>,
		);
		expect(html).toStartWith("<a ");
		expect(html).not.toContain("<button");
	});
	test("icon toggle keeps its accessible name and selected state", () => {
		const html = render(
			<IconButton aria-label="暂停音乐" selected disabled>
				Ⅱ
			</IconButton>,
		);
		expect(html).toContain('aria-label="暂停音乐"');
		expect(html).toContain('aria-pressed="true"');
		expect(html).toContain('disabled=""');
	});
	test("loading has a stable readable status", () => {
		expect(render(<LoadingIndicator label="正在同步" />)).toContain(
			'role="status"',
		);
		expect(render(<LoadingIndicator label="正在同步" />)).toContain(
			'aria-label="正在同步"',
		);
	});
	test("all 35 exported source shapes have finite closed cubic paths", () => {
		expect(Object.keys(shapes)).toHaveLength(35);
		for (const shape of Object.values(shapes)) {
			expect(shape.path).toStartWith("M");
			expect(shape.path).toEndWith("Z");
			expect(shape.path).toContain("C");
			expect(shape.path).not.toMatch(/NaN|Infinity/);
		}
	});
});
