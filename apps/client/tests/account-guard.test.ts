import { beforeEach, describe, expect, test } from "bun:test";
import type { AuthMeResponse, UserRole } from "@cogm/shared";
import { isRedirect } from "@tanstack/react-router";
import { requireAccount, roleHome } from "../src/lib/identity";

type RedirectOptions = { href?: string; to?: string };

let account: AuthMeResponse | null = null;

function stubAuthMe(): void {
	globalThis.fetch = (async () =>
		account
			? new Response(JSON.stringify(account), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				})
			: new Response(JSON.stringify({ code: "AUTH_REQUIRED" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				})) as unknown as typeof fetch;
}

async function redirectOptions(
	roles: UserRole[],
): Promise<RedirectOptions | null> {
	const error = await requireAccount(roles).catch((cause: unknown) => cause);
	expect(isRedirect(error)).toBe(true);
	if (!isRedirect(error)) {
		return null;
	}
	return error.options as RedirectOptions;
}

const homes: Record<UserRole, string> = {
	admin: "/admin",
	gm: "/gm",
	pl: "/pl",
};

const roles = Object.keys(homes) as UserRole[];

describe("account guard", () => {
	beforeEach(() => {
		account = null;
		stubAuthMe();
	});

	test("roleHome maps each role to its own workspace", () => {
		expect(roles.map((role) => roleHome(role))).toEqual([
			"/admin",
			"/gm",
			"/pl",
		]);
	});

	for (const allowed of roles) {
		test(`allows an authenticated ${allowed} on an ${allowed} route`, async () => {
			account = {
				type: "user",
				userId: `user-${allowed}`,
				username: allowed,
				role: allowed,
			};

			const result = await requireAccount([allowed]);

			expect(result).toEqual(account);
		});
	}

	for (const actual of roles) {
		for (const allowed of roles.filter((role) => role !== actual)) {
			test(`redirects an authenticated ${actual} away from an ${allowed} route to ${homes[actual]}`, async () => {
				account = {
					type: "user",
					userId: `user-${actual}`,
					username: actual,
					role: actual,
				};

				const options = await redirectOptions([allowed]);

				expect(options).toMatchObject({ to: homes[actual] });
				expect(options?.href).toBeUndefined();
			});
		}
	}

	test("an unauthenticated user goes to /login", async () => {
		const options = await redirectOptions(["pl"]);

		expect(options).toMatchObject({ to: "/login" });
		expect(options?.href).toBeUndefined();
	});
});
