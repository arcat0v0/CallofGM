import { type Env, parseEnv } from "@/config/env";
import { type MusicService, OfficialMusicService } from "@/modules/music";
import {
	BuildSessionSnapshotUseCase,
	type CommandHandler,
	ConnectionRegistry,
	EventRingBuffer,
	PresenceService,
	SessionCommandExecutor,
	SessionEventBus,
	SessionHistoryRecorder,
	VoiceService,
} from "@/modules/realtime";
import { ThemeRegistry } from "@/modules/themes";
import { createDb, type DbClient, type DbContext } from "@/platform/db/client";
import {
	DrizzleTransactionRunner,
	type TransactionRunner,
} from "@/platform/db/transaction";
import {
	type Clock,
	type IdGenerator,
	type RandomSource,
	SecureRandomSource,
	SystemClock,
	UuidGenerator,
} from "@/platform/ports";
import { HttpLimits } from "@/platform/security/http-limits";
import { Coc7eRuleSystem } from "@/rules/coc7e";
import { RuleRegistry } from "@/rules/registry";
import { StartupService } from "./startup";

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

	readonly musicService: MusicService;
	readonly connectionRegistry: ConnectionRegistry;
	readonly eventRingBuffer: EventRingBuffer;
	readonly voiceService: VoiceService;
	readonly presenceService: PresenceService;
	readonly historyRecorder: SessionHistoryRecorder;
	readonly sessionEventBus: SessionEventBus;
	readonly sessionCommandExecutor: SessionCommandExecutor;
	readonly snapshotBuilder: BuildSessionSnapshotUseCase;

	constructor(
		commandHandlers: CommandHandler[] = [],
		overrides: {
			clock?: Clock;
			idGenerator?: IdGenerator;
			randomSource?: RandomSource;
			httpLimits?: HttpLimits;
			musicService?: MusicService;
		} = {},
	) {
		this.env = parseEnv();
		this.dbContext = createDb(this.env.DATABASE_URL);
		this.db = this.dbContext.db;
		this.transactionRunner = new DrizzleTransactionRunner(this.db);
		this.clock = overrides.clock ?? new SystemClock();
		this.idGenerator = overrides.idGenerator ?? new UuidGenerator();
		this.randomSource = overrides.randomSource ?? new SecureRandomSource();
		this.startupService = new StartupService(
			this.dbContext.sqlite,
			this.db,
			this.env.DATABASE_URL,
		);
		this.httpLimits = overrides.httpLimits ?? new HttpLimits();

		this.musicService = overrides.musicService ?? new OfficialMusicService();
		this.ruleRegistry = new RuleRegistry();
		this.ruleRegistry.register(new Coc7eRuleSystem());
		this.themeRegistry = new ThemeRegistry(this.env.THEMES_DIR, this.clock);

		this.connectionRegistry = new ConnectionRegistry(this.db);
		this.voiceService = new VoiceService(
			this.db,
			this.connectionRegistry,
			this.env,
		);
		this.eventRingBuffer = new EventRingBuffer();
		this.presenceService = new PresenceService(
			this.db,
			this.connectionRegistry,
		);
		this.historyRecorder = new SessionHistoryRecorder(
			this.idGenerator,
			this.clock,
		);
		this.sessionEventBus = new SessionEventBus(
			this.db,
			this.transactionRunner,
			this.eventRingBuffer,
			this.connectionRegistry,
			this.clock,
			this.idGenerator,
			this.historyRecorder,
			this.voiceService,
		);
		this.sessionCommandExecutor = new SessionCommandExecutor(
			this.db,
			this.transactionRunner,
			this.sessionEventBus,
			this.presenceService,
			this.connectionRegistry,
			this.clock,
			this.idGenerator,
			this.randomSource,
			this.historyRecorder,
			this.voiceService,
		);
		this.sessionCommandExecutor.registerHandlers(commandHandlers);
		this.snapshotBuilder = new BuildSessionSnapshotUseCase(
			this.db,
			this.ruleRegistry,
			this.presenceService,
		);
	}
}
