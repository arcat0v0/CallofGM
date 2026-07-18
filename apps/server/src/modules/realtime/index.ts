export { createRealtimeRoutes as routes, createRealtimeRoutes } from "./transport/ws-handler";
export { ConnectionRegistry, type ActiveConnection } from "./connection-registry";
export { SessionCommandExecutor } from "./session-command-executor";
export { SessionEventBus, type StagedEvents } from "./session-event-bus";
export { EventRingBuffer, type BufferedEvent } from "./event-ring-buffer";
export { PresenceService } from "./presence-service";
export { BuildSessionSnapshotUseCase } from "./application/build-snapshot";
export { checkVisibility, type VisibilityScope } from "./domain/visibility";
export {
  type CommandHandler,
  type CommandHandlerContext,
  type CommandHandlerResult,
  type ProducedEvent,
} from "./application/command-handler";
