import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type * as React from "react";

const actualRouter = await import("@tanstack/react-router");
type NavigateTarget = { to: string; params?: Record<string, string> };
let navigateCalls: NavigateTarget[] = [];

function MockLink({
	to,
	children,
	...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
	return (
		<a href={to} {...props}>
			{children}
		</a>
	);
}

mock.module("@tanstack/react-router", () => ({
	...actualRouter,
	useNavigate: () => async (target: NavigateTarget) => {
		navigateCalls.push(target);
	},
	Link: MockLink,
}));

const { HomePage } = await import("../src/routes/index");

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function stubFetch(fn: (input: RequestInfo | URL) => Promise<Response>) {
	globalThis.fetch = fn as unknown as typeof fetch;
}

function setInputValue(element: HTMLElement, value: string) {
	fireEvent.input(element, { target: { value } });
}

function submitForm(view: ReturnType<typeof render>) {
	const button = view.getByRole("button", { name: "进入" });
	fireEvent.click(button);
}

describe("Home session entry", () => {
	beforeEach(() => {
		navigateCalls = [];
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("renders intro copy and preserves bottom account login entry", () => {
		const view = render(<HomePage />);
		expect(
			view.getByText(
				"CoC 7e 在线跑团工具。输入主持人分享的团链接或编号，即可加入场景与对话。",
			),
		).toBeTruthy();
		const link = view.getByRole("link", { name: "账号登录" });
		expect(link.getAttribute("href")).toBe("/login");
	});

	test("navigates directly for full UUID and full UUID invitation URLs without resolving", async () => {
		const calls: string[] = [];
		stubFetch(async (input) => {
			calls.push(String(input));
			return jsonResponse(500, { code: "UNEXPECTED" });
		});

		const uuid = "550e8400-e29b-41d4-a716-446655440000";
		const first = render(<HomePage />);
		const firstInput = first.getByLabelText("团链接或编号") as HTMLInputElement;
		setInputValue(firstInput, `https://cogm.example/join/${uuid}?ref=share`);
		submitForm(first);
		await waitFor(() => {
			expect(navigateCalls).toEqual([
				{ to: "/join/$sessionId", params: { sessionId: uuid } },
			]);
		});
		expect(calls).toHaveLength(0);
		first.unmount();

		navigateCalls = [];
		const second = render(<HomePage />);
		setInputValue(second.getByLabelText("团链接或编号"), `  ${uuid}  `);
		submitForm(second);
		await waitFor(() => {
			expect(navigateCalls).toEqual([
				{ to: "/join/$sessionId", params: { sessionId: uuid } },
			]);
		});
		expect(calls).toHaveLength(0);
	});

	test("resolves six-character references including # and /join/<short> before navigating", async () => {
		const canonical = "a1b2c3d4-0000-4000-8000-000000000001";
		for (const rawInput of [
			"a1b2c3",
			"  #A1B2C3  ",
			"https://cogm.example/join/A1B2C3?from=copy",
		]) {
			navigateCalls = [];
			const calls: string[] = [];
			stubFetch(async (input) => {
				calls.push(String(input));
				return jsonResponse(200, { sessionId: canonical });
			});

			const view = render(<HomePage />);
			setInputValue(view.getByLabelText("团链接或编号"), rawInput);
			submitForm(view);

			await waitFor(() => {
				expect(navigateCalls).toEqual([
					{ to: "/join/$sessionId", params: { sessionId: canonical } },
				]);
			});
			expect(calls).toEqual(["/api/v1/public/session-references/a1b2c3"]);
			view.unmount();
		}
	});

	test("protects against duplicate submit and input edits while resolving", async () => {
		const canonical = "a1b2c3d4-0000-4000-8000-000000000001";
		const deferred = Promise.withResolvers<Response>();
		let fetchCount = 0;
		stubFetch(async () => {
			fetchCount += 1;
			return deferred.promise;
		});

		const view = render(<HomePage />);
		const input = view.getByLabelText("团链接或编号") as HTMLInputElement;
		setInputValue(input, "a1b2c3");

		const form = view.container.querySelector("form");
		if (!form) {
			throw new Error("missing form");
		}
		submitForm(view);
		fireEvent.submit(form);

		await waitFor(() => {
			const pendingBtn = view.getByRole("button", { name: "正在查找团…" });
			expect((pendingBtn as HTMLButtonElement).disabled).toBe(true);
			expect(input.disabled).toBe(true);
		});
		setInputValue(input, "b1b2b3");
		expect(fetchCount).toBe(1);
		expect(navigateCalls).toHaveLength(0);

		deferred.resolve(jsonResponse(200, { sessionId: canonical }));
		await waitFor(() => {
			expect(navigateCalls).toEqual([
				{ to: "/join/$sessionId", params: { sessionId: canonical } },
			]);
		});
		view.unmount();

		navigateCalls = [];
		const failedDeferred = Promise.withResolvers<Response>();
		stubFetch(async () => failedDeferred.promise);
		const retryView = render(<HomePage />);
		const retryInput = retryView.getByLabelText(
			"团链接或编号",
		) as HTMLInputElement;
		setInputValue(retryInput, "a1b2c3");
		submitForm(retryView);

		await waitFor(() => {
			expect(retryInput.disabled).toBe(true);
		});
		setInputValue(retryInput, "b1b2b3");

		failedDeferred.resolve(jsonResponse(404, { code: "SESSION_NOT_FOUND" }));
		await waitFor(() => {
			expect(retryInput.disabled).toBe(false);
			expect(retryView.getByRole("alert").textContent).toBe(
				"找不到这个团，请检查链接或编号",
			);
		});
		expect(retryInput.value).toBe("a1b2c3");
		expect(navigateCalls).toHaveLength(0);
	});

	test("displays error copy and does not navigate on 404, 409, 429, and malformed percent input", async () => {
		for (const scenario of [
			{
				input: "deadbe",
				status: 404,
				code: "SESSION_NOT_FOUND",
				expected: "找不到这个团，请检查链接或编号",
			},
			{
				input: "#deadbe",
				status: 409,
				code: "SESSION_REFERENCE_AMBIGUOUS",
				expected: "这个团编号对应多个团，请改用完整邀请链接",
			},
			{
				input: "/join/deadbe",
				status: 429,
				code: "RATE_LIMITED",
				expected: "操作太频繁，请稍后再试",
			},
		]) {
			navigateCalls = [];
			stubFetch(async () =>
				jsonResponse(scenario.status, {
					code: scenario.code,
				}),
			);

			const view = render(<HomePage />);
			setInputValue(view.getByLabelText("团链接或编号"), scenario.input);
			submitForm(view);

			const alert = await view.findByRole("alert");
			await waitFor(() => {
				expect(alert.textContent).toBe(scenario.expected);
			});
			expect(navigateCalls).toHaveLength(0);
			view.unmount();
		}

		navigateCalls = [];
		let malformedFetchCount = 0;
		stubFetch(async () => {
			malformedFetchCount += 1;
			return jsonResponse(500, {});
		});
		const malformedView = render(<HomePage />);
		setInputValue(malformedView.getByLabelText("团链接或编号"), "/join/%ZZ");
		submitForm(malformedView);
		await waitFor(() => {
			expect(malformedView.getByRole("alert").textContent).toBe(
				"找不到这个团，请检查链接或编号",
			);
		});
		setInputValue(
			malformedView.getByLabelText("团链接或编号"),
			"550e8400-e29b-41d4-a716-446655440000",
		);
		expect(malformedView.getByRole("alert").textContent).toBe("");
		expect(malformedFetchCount).toBe(0);
		expect(navigateCalls).toHaveLength(0);
	});
});
