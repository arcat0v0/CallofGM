import type { Container } from "./container";
import { createChatCommandHandlers } from "@/modules/chat";
import { createGameplayCommandHandlers } from "@/modules/gameplay";
import { createHandoutCommandHandlers } from "@/modules/handouts";
import { createModerationCommandHandlers } from "@/modules/moderation";
import { createStageCommandHandlers } from "@/modules/sessions";
import type { CommandHandler } from "@/modules/realtime";

/**
 * 全量实时命令处理器注册（composition root 的一部分）。
 * 生产入口与测试环境必须共用此函数，禁止各自拼装导致行为漂移。
 */
export function buildCommandHandlers(container: Container): CommandHandler[] {
  return [
    ...createChatCommandHandlers(),
    ...createGameplayCommandHandlers(container.ruleRegistry),
    ...createStageCommandHandlers(),
    ...createHandoutCommandHandlers(),
    ...createModerationCommandHandlers(),
  ];
}
