import { parseEnv, type Env } from "@/config/env";
import { createDb, type DbClient, type DbContext } from "@/platform/db/client";
import { DrizzleTransactionRunner, type TransactionRunner } from "@/platform/db/transaction";
import { SystemClock, UuidGenerator, SecureRandomSource, type Clock, type IdGenerator, type RandomSource } from "@/platform/ports";
import { HttpLimits } from "@/platform/security/http-limits";
import { StartupService } from "./startup";
import { RuleRegistry } from "@/rules/registry";
import { ThemeRegistry } from "@/modules/themes";
import { Coc7eRuleSystem } from "@/rules/coc7e";
import {
  ConnectionRegistry,
  EventRingBuffer,
  PresenceService,
  SessionCommandExecutor,
  SessionEventBus,
  BuildSessionSnapshotUseCase,
  type CommandHandler,
} from "@/modules/realtime";

export class Container {
  readonly env: Env;
  readonly dbContext: DbContext;
  readonly db: DbClient;
  readonly transactionRunner: TransactionRunner;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly randomSource: RandomSource;
  readonly startupService: StartupService;
  readonly ruleRegistry: RuleRegistry;
  readonly httpLimits: HttpLimits;
  readonly themeRegistry: ThemeRegistry;

  readonly connectionRegistry: ConnectionRegistry;
  readonly eventRingBuffer: EventRingBuffer;
  readonly presenceService: PresenceService;
  readonly sessionEventBus: SessionEventBus;
  readonly sessionCommandExecutor: SessionCommandExecutor;
  readonly snapshotBuilder: BuildSessionSnapshotUseCase;

  constructor(
    commandHandlers: CommandHandler[] = [],
    overrides: { clock?: Clock; idGenerator?: IdGenerator; randomSource?: RandomSource; httpLimits?: HttpLimits } = {}
  ) {
    this.env = parseEnv();
    this.dbContext = createDb(this.env.DATABASE_URL);
    this.db = this.dbContext.db;
    this.transactionRunner = new DrizzleTransactionRunner(this.db);
    this.clock = overrides.clock ?? new SystemClock();
    this.idGenerator = overrides.idGenerator ?? new UuidGenerator();
    this.randomSource = overrides.randomSource ?? new SecureRandomSource();
    this.startupService = new StartupService(this.dbContext.sqlite, this.db, this.env.DATABASE_URL);
    this.httpLimits = overrides.httpLimits ?? new HttpLimits();

    this.ruleRegistry = new RuleRegistry();
    this.ruleRegistry.register(new Coc7eRuleSystem());
    this.themeRegistry = new ThemeRegistry(this.env.THEMES_DIR, this.clock);

    this.connectionRegistry = new ConnectionRegistry(this.db);
    this.eventRingBuffer = new EventRingBuffer();
    this.presenceService = new PresenceService(this.db, this.connectionRegistry);
    this.sessionEventBus = new SessionEventBus(
      this.db,
      this.transactionRunner,
      this.eventRingBuffer,
      this.connectionRegistry,
      this.clock,
      this.idGenerator
    );
    this.sessionCommandExecutor = new SessionCommandExecutor(
      this.db,
      this.transactionRunner,
      this.sessionEventBus,
      this.presenceService,
      this.connectionRegistry,
      this.clock,
      this.idGenerator,
      this.randomSource
    );
    this.sessionCommandExecutor.registerHandlers(commandHandlers);
    this.snapshotBuilder = new BuildSessionSnapshotUseCase(
      this.db,
      this.ruleRegistry,
      this.presenceService
    );
  }
}
