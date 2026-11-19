import { type Env, parseEnv } from "@/config/env";
import { DrizzleTrashRepository, type TrashRepository } from "@/modules/admin";
import {
	type CatalogRepository,
	DrizzleCatalogRepository,
} from "@/modules/catalog";
import {
	type CharactersRepository,
	DrizzleCharactersRepository,
} from "@/modules/characters";
import {
	createAuthPlugin,
	DrizzleIdentityRepository,
	type IdentityRepository,
} from "@/modules/identity";
import {
	DrizzleMediaRepository,
	LocalMediaStorage,
	type MediaRepository,
	type MediaStorage,
} from "@/modules/media";
import {
	DrizzleModerationRepository,
	type ModerationRepository,
} from "@/modules/moderation";
import {
	DrizzleMusicTrackAccessRepository,
	type MusicService,
	type MusicTrackAccessRepository,
	OfficialMusicService,
} from "@/modules/music";
import {
	BuildSessionSnapshotUseCase,
	type CommandHandler,
	ConnectionRegistry,
	DrizzleActiveClaimLookup,
	DrizzleVoiceSessionStore,
	EventRingBuffer,
	PresenceService,
	SessionCommandExecutor,
	SessionEventBus,
	SessionHistoryRecorder,
	VoiceService,
} from "@/modules/realtime";
import {
	DrizzleSessionsRepository,
	type SessionsRepository,
} from "@/modules/sessions";
import {
	DrizzleTemplatesRepository,
	type TemplatesRepository,
} from "@/modules/templates";
import {
	DrizzleThemeUsageRepository,
	ThemeRegistry,
	type ThemeUsageRepository,
} from "@/modules/themes";
import {
	DrizzleUiSettingsRepository,
	type UiSettingsRepository,
} from "@/modules/ui-settings";
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
import { Dnd5rRuleSystem } from "@/rules/dnd5r";
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

	readonly identityRepo: IdentityRepository;
	readonly authPlugin: ReturnType<typeof createAuthPlugin>;
	readonly sessionsRepo: SessionsRepository;
	readonly charactersRepo: CharactersRepository;
	readonly catalogRepo: CatalogRepository;
	readonly moderationRepo: ModerationRepository;
	readonly templatesRepo: TemplatesRepository;
	readonly uiSettingsRepo: UiSettingsRepository;
	readonly mediaStorage: MediaStorage;
	readonly mediaRepo: MediaRepository;
	readonly musicTrackAccessRepo: MusicTrackAccessRepository;
	readonly trashRepo: TrashRepository;
	readonly themeUsageRepo: ThemeUsageRepository;

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
		this.identityRepo = new DrizzleIdentityRepository(this.db);
		this.authPlugin = createAuthPlugin(this.identityRepo);
		this.sessionsRepo = new DrizzleSessionsRepository(this.db);
		this.charactersRepo = new DrizzleCharactersRepository(this.db);
		this.catalogRepo = new DrizzleCatalogRepository(this.db);
		this.moderationRepo = new DrizzleModerationRepository(this.db);
		this.templatesRepo = new DrizzleTemplatesRepository(this.db);
		this.uiSettingsRepo = new DrizzleUiSettingsRepository(this.db);
		this.mediaStorage = new LocalMediaStorage(this.env.MEDIA_DIR);
		this.mediaRepo = new DrizzleMediaRepository(this.db);
		this.musicTrackAccessRepo = new DrizzleMusicTrackAccessRepository(this.db);
		this.trashRepo = new DrizzleTrashRepository(this.db);
		this.themeUsageRepo = new DrizzleThemeUsageRepository(this.db);
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
		this.ruleRegistry.register(new Dnd5rRuleSystem());
		this.themeRegistry = new ThemeRegistry(this.env.THEMES_DIR, this.clock);

		this.connectionRegistry = new ConnectionRegistry(
			new DrizzleActiveClaimLookup(this.db),
		);
		this.voiceService = new VoiceService(
			new DrizzleVoiceSessionStore(this.db),
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
