import { type RuleId } from "@cogm/shared";
import { type RuleSystem } from "./rule-system";

export class RuleRegistry {
  private systems = new Map<RuleId, RuleSystem<unknown, unknown>>();

  register<TSheet, TState>(system: RuleSystem<TSheet, TState>): void {
    this.systems.set(
      system.id,
      system as unknown as RuleSystem<unknown, unknown>
    );
  }

  get(id: RuleId): RuleSystem<unknown, unknown> {
    const system = this.systems.get(id);
    if (!system) {
      throw new Error(`Rule system not found: ${id}`);
    }
    return system;
  }
}
