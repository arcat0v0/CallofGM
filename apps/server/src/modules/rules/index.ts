import { Elysia } from "elysia";
import type { Container } from "@/bootstrap/container";
import { RuleListResponse } from "@cogm/shared";

export function createRulesRoutes(container: Container) {
  return new Elysia().get("/api/v1/rules", () => {
    return RuleListResponse.parse(container.ruleRegistry.listCompatible());
  });
}
