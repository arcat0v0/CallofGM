import { coc7eComponent } from "./coc7e/component";
import { dnd5rComponent } from "./dnd5r/component";
import type { RuleComponent } from "./types";

const registry = new Map<string, RuleComponent>([
	[coc7eComponent.metadata.id, coc7eComponent],
	[dnd5rComponent.metadata.id, dnd5rComponent],
]);

export const FALLBACK_RULE_ID = coc7eComponent.metadata.id;

export function getRuleComponent(
	ruleId: string | null | undefined,
): RuleComponent {
	if (ruleId) {
		const found = registry.get(ruleId);
		if (found) {
			return found;
		}
	}
	return coc7eComponent;
}

export function registerRuleComponent(component: RuleComponent): void {
	registry.set(component.metadata.id, component);
}

export function listRuleComponents(): RuleComponent[] {
	return [...registry.values()];
}
