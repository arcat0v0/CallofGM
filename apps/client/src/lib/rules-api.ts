import type { RuleMetadata } from "@cogm/shared";
import { useEffect, useState } from "react";
import { FALLBACK_RULE_ID, listRuleComponents } from "@/rules/registry";
import { api } from "./api";

function localRules(): RuleMetadata[] {
	return listRuleComponents().map((component) => component.metadata);
}

export function useRuleOptions(): {
	rules: RuleMetadata[];
	ruleId: string;
	setRuleId: (ruleId: string) => void;
	loading: boolean;
} {
	const [rules, setRules] = useState<RuleMetadata[]>(() => localRules());
	const [ruleId, setRuleId] = useState<string>(FALLBACK_RULE_ID);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		void api<RuleMetadata[]>("/rules")
			.then((list) => {
				if (cancelled || !Array.isArray(list) || list.length === 0) {
					return;
				}
				setRules(list);
				setRuleId((current) =>
					list.some((rule) => rule.id === current) ? current : list[0]!.id,
				);
			})
			.catch(() => undefined)
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return { rules, ruleId, setRuleId, loading };
}
