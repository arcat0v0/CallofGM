import { afterEach, describe, expect, test } from "bun:test";
import { resetMessageRuntime, setMessageRuntime, translate } from "@/i18n";

afterEach(() => {
	resetMessageRuntime();
});

describe("i18n", () => {
	test("falls back to the base locale and returns the key when missing", () => {
		setMessageRuntime("ja-JP", {
			"ja-JP": { greet: "こんにちは {name}" },
			"zh-CN": { greet: "你好 {name}", onlyZh: "仅中文" },
		});
		expect(translate("greet", { name: "小明" })).toBe("こんにちは 小明");
		expect(translate("onlyZh")).toBe("仅中文");
		expect(translate("missing.key")).toBe("missing.key");
	});

	test("ignores dangerous message keys", () => {
		const overrides = JSON.parse(
			'{"zh-CN":{"__proto__":{"polluted":"yes"},"constructor":"x"}}',
		) as Record<string, Record<string, string>>;
		setMessageRuntime("zh-CN", overrides);
		expect(translate("polluted")).toBe("polluted");
		expect(({} as { polluted?: string }).polluted).toBeUndefined();
	});
});
