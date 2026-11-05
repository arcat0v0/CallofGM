import { describe, expect, test } from "bun:test";
import { loginHref, safeReturnTo } from "@cogm/shared";
import { t } from "../src/i18n";

const root = new URL("../src/", import.meta.url);

async function source(path: string): Promise<string> {
	return Bun.file(new URL(path, root)).text();
}

describe("account login entry", () => {
	test("the home page exposes one shared account login link", async () => {
		const home = await source("routes/index.tsx");
		expect(home).toContain('<Link to="/login">');
		expect(t("home.accountEntry")).toBe("账号登录");
		expect(home).toContain('t("home.accountEntry")');
		expect(home).not.toContain('t("home.gmEntry")');
	});

	test("login preserves a validated invitation destination", async () => {
		const login = await source("routes/login.tsx");
		expect(login).toContain("validateSearch");
		expect(login).toContain("safeReturnTo(search.returnTo)");
		expect(login).toContain("navigate({ href: returnTo })");
		const destination = safeReturnTo("/join/session-1");
		expect(destination).toBe("/join/session-1");
		expect(loginHref(destination)).toBe("/login?returnTo=%2Fjoin%2Fsession-1");
	});

	test("a join page offers login before an anonymous PC claim", async () => {
		const join = await source("routes/join.$sessionId.tsx");
		expect(join).toContain("PLAYER_LOGIN_REQUIRED");
		expect(join).toContain("search={{ returnTo:");
		// biome-ignore lint/suspicious/noTemplateCurlyInString: assertion matches route source template
		expect(join).toContain("`/join/${sessionId}`");
		expect(join).toContain('t("join.loginToClaim")');
		expect(t("join.loginToClaim")).toBe("登录并认领");
	});

	test("a character invite links back to itself after login", async () => {
		const submit = await source("routes/submit.$token.tsx");
		expect(submit).toContain('requireAccount(["pl"])');
		expect(submit).toContain("safeReturnTo(");
		// biome-ignore lint/suspicious/noTemplateCurlyInString: assertion matches route source template
		expect(submit).toContain("`/submit/${params.token}`");
		expect(safeReturnTo("/submit/invite-1")).toBe("/submit/invite-1");
	});
});
