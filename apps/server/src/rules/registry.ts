import { type RuleSystem, RULE_API_VERSION, type RuleMetadata } from "./rule-system";

export class RuleNotFoundError extends Error {
  readonly code = "RULE_NOT_FOUND";

  constructor(public readonly ruleId: string) {
    super(`Rule system not found: ${ruleId}`);
  }
}

export class RuleRegistry {
  private systems = new Map<string, RuleSystem<unknown, unknown>>();
  private order: string[] = [];

  register<TSheet, TState>(system: RuleSystem<TSheet, TState>): void {
    const cast = system as unknown as RuleSystem<unknown, unknown>;
    if (!this.systems.has(system.id)) {
      this.order.push(system.id);
    }
    this.systems.set(system.id, cast);
  }

  get(id: string): RuleSystem<unknown, unknown> {
    const system = this.systems.get(id);
    if (!system) {
      throw new RuleNotFoundError(id);
    }
    return system;
  }

  has(id: string): boolean {
    return this.systems.has(id);
  }

  /** 只返回与核心契约兼容的规则，供前端选择器消费 */
  listCompatible(): RuleMetadata[] {
    return this.listAll().filter((metadata) => metadata.apiVersion === RULE_API_VERSION);
  }

  listAll(): RuleMetadata[] {
    return this.order.map((id) => this.systems.get(id)!.metadata);
  }
}
