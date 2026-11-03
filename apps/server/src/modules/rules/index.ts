import { RuleListResponse } from "@cogm/shared";
import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";

export function createRulesRoutes(container: Container) {
	return new Elysia().get("/api/v1/rules", () => {
		return RuleListResponse.parse(container.ruleRegistry.listCompatible());
	});
}
