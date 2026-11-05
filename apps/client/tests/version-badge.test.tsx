import { describe, expect, test } from "bun:test";
import type { BuildInfo, VersionResponse } from "@cogm/shared";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { VersionBadge } from "../src/features/version/version-badge";

const client: BuildInfo = {
	version: "0.1.0",
	commit: "abcdef0123456789",
	buildTime: "2026-11-05T10:20:30.000Z",
	component: "client",
};

const server: BuildInfo = {
	version: "0.1.0",
	commit: "abcdef0123456789",
	buildTime: "2026-11-05T11:22:33.000Z",
	component: "server",
};

function response(value: BuildInfo = server): VersionResponse {
	return { server: value };
}

describe("VersionBadge", () => {
	test("shows client version on the trigger and both builds on demand", async () => {
		const view = render(
			<VersionBadge client={client} loadVersion={async () => response()} />,
		);

		fireEvent.click(view.getByRole("button", { name: "v0.1.0" }));

		expect(await view.findByText("版本信息")).toBeTruthy();
		expect(view.getByText("网页")).toBeTruthy();
		expect(view.getByText("后端")).toBeTruthy();
		expect(view.getByText("2026-11-05 10:20:30 UTC")).toBeTruthy();
		expect(view.getByText("2026-11-05 11:22:33 UTC")).toBeTruthy();
		expect(view.queryByText("版本不一致")).toBeNull();
	});

	test("shows backend unknown and retries after a failed request", async () => {
		let attempts = 0;
		const view = render(
			<VersionBadge
				client={client}
				loadVersion={async () => {
					attempts += 1;
					if (attempts === 1) {
						throw new Error("offline");
					}
					return response();
				}}
			/>,
		);

		fireEvent.click(view.getByRole("button", { name: "v0.1.0" }));
		expect(await view.findByText("后端未知")).toBeTruthy();
		fireEvent.click(view.getByRole("button", { name: "重试" }));

		expect(await view.findByText("2026-11-05 11:22:33 UTC")).toBeTruthy();
		expect(attempts).toBe(2);
	});

	test("warns when client and server builds differ", async () => {
		const view = render(
			<VersionBadge
				client={client}
				loadVersion={async () => response({ ...server, version: "0.2.0" })}
			/>,
		);

		fireEvent.click(view.getByRole("button", { name: "v0.1.0" }));
		expect(await view.findByText("版本不一致")).toBeTruthy();
	});

	test("copies the same build values shown in the dialog", async () => {
		let copied = "";
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					copied = text;
				},
			},
		});
		const view = render(
			<VersionBadge client={client} loadVersion={async () => response()} />,
		);

		fireEvent.click(view.getByRole("button", { name: "v0.1.0" }));
		await view.findByText("2026-11-05 11:22:33 UTC");
		fireEvent.click(view.getByRole("button", { name: "复制全部" }));

		await waitFor(() => {
			expect(copied).toContain("网页版本：0.1.0");
			expect(copied).toContain("网页提交：abcdef0");
			expect(copied).toContain("后端版本：0.1.0");
			expect(copied).toContain("后端提交：abcdef0");
			expect(copied).toContain("后端构建时间：2026-11-05 11:22:33 UTC");
		});
	});
});
