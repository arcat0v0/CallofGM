import type { ComponentType, ReactNode } from "react";
import type { SessionPhase, SessionStatus } from "@cogm/shared";

export const THEME_SLOT_NAMES = [
  "join.layout",
  "join.header",
  "join.seat-card",
  "play.layout",
  "play.stage",
  "play.scene-info",
  "play.dialogue",
  "play.chat-panel",
  "play.chat-message",
  "gm-console.layout",
  "gm-console.stage",
  "gm-admin.shell",
  "gm-admin.nav",
] as const;

export type ThemeSlotName = (typeof THEME_SLOT_NAMES)[number];

export type PlayViewport = "desktop" | "landscape" | "portrait";

export type ChatMessageView = {
  id: string;
  speakerName: string;
  speakerRoleLabel: string;
  avatarInitials: string;
  avatarBg: string;
  avatarFg: string;
  time: string;
  body: string;
  tone: "ic" | "ooc";
  isSystem: boolean;
  self: boolean;
  continued: boolean;
  showRoleBadge: boolean;
};

export type JoinSeatView = {
  id: string;
  name: string;
  detail: string;
  initial?: string;
  kind: "character" | "spectator";
  claimed: boolean;
};

export type JoinLayoutCtx = {
  nodes: {
    header: ReactNode;
    notice: ReactNode;
    seats: ReactNode;
    spectator: ReactNode;
    action: ReactNode;
  };
  view: {
    sessionId: string;
    status: SessionStatus | null;
    moduleName: string | null;
    sessionName: string | null;
    loading: boolean;
    joining: boolean;
    selectedName: string | null;
    ended: boolean;
    loadError: string | null;
  };
  actions: {
    join: () => void;
  };
};

export type JoinHeaderCtx = {
  status: SessionStatus | null;
  moduleName: string | null;
  sessionName: string | null;
  loading: boolean;
  ended: boolean;
  loadError: string | null;
};

export type JoinSeatCardCtx = {
  seat: JoinSeatView;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  variant: "card" | "row";
  className?: string;
};

export type PlayLayoutCtx = {
  viewport: PlayViewport;
  nodes: {
    stage: ReactNode;
    chat: ReactNode;
    composer: ReactNode;
    overlays: ReactNode;
    connection: ReactNode;
  };
  view: {
    sessionId: string;
    status: SessionStatus | null;
    phase: SessionPhase | null;
    landscapeChatOpen: boolean;
  };
  actions: {
    setLandscapeChatOpen: (open: boolean) => void;
  };
};

export type PlayStageView = {
  sceneName: string;
  sceneBgUrl: string | null;
  status: SessionStatus | null;
  phase: SessionPhase | null;
  hasDialogue: boolean;
};

export type PlayStageCtx = {
  viewport: PlayViewport;
  view: PlayStageView;
  nodes: {
    sceneInfo: ReactNode;
    portrait: ReactNode;
    dialogue: ReactNode;
    audio: ReactNode;
  };
};

export type PlaySceneInfoCtx = {
  variant: PlayViewport;
};

export type PlayDialogueCtx = {
  messageId: string;
  speaker: string;
  roleLabel?: string;
  text: string;
  size: "md" | "sm";
};

export type PlayChatPanelCtx = {
  sessionId: string;
  variant: PlayViewport;
  compact: boolean;
  messages: ChatMessageView[];
  selfName: string;
  onCollapse?: () => void;
};

export type PlayChatMessageCtx = {
  message: ChatMessageView;
  variant: PlayViewport;
};

export type GmConsoleLayoutCtx = {
  nodes: {
    topbar?: ReactNode;
    controls: ReactNode;
    stage: ReactNode;
    chat: ReactNode;
    dock?: ReactNode;
    overlays: ReactNode;
    connection: ReactNode;
    endedBanner: ReactNode;
  };
  view: {
    sessionId: string;
    status: SessionStatus | null;
  };
};

export type GmConsoleStageCtx = {
  view: PlayStageView;
  nodes: {
    sceneInfo: ReactNode;
    portrait: ReactNode;
    dialogue: ReactNode;
    audio: ReactNode;
  };
};

export type GmAdminNavItem = {
  key: string;
  label: string;
  to: string;
  active: boolean;
  icon: ComponentType<{ className?: string }>;
};

export type GmAdminNavCtx = {
  items: GmAdminNavItem[];
  onNavigate: (to: string) => void;
  onLogout: () => void;
};

export type GmAdminShellCtx = {
  nodes: {
    nav: ReactNode;
    content: ReactNode;
  };
  view: {
    active: string | null;
  };
};

export interface ThemeSlotCtxMap {
  "join.layout": JoinLayoutCtx;
  "join.header": JoinHeaderCtx;
  "join.seat-card": JoinSeatCardCtx;
  "play.layout": PlayLayoutCtx;
  "play.stage": PlayStageCtx;
  "play.scene-info": PlaySceneInfoCtx;
  "play.dialogue": PlayDialogueCtx;
  "play.chat-panel": PlayChatPanelCtx;
  "play.chat-message": PlayChatMessageCtx;
  "gm-console.layout": GmConsoleLayoutCtx;
  "gm-console.stage": GmConsoleStageCtx;
  "gm-admin.shell": GmAdminShellCtx;
  "gm-admin.nav": GmAdminNavCtx;
}

export type ThemeSlotComponent<K extends ThemeSlotName> = ComponentType<ThemeSlotCtxMap[K]>;

export type ThemeSlots = {
  [K in ThemeSlotName]?: ThemeSlotComponent<K>;
};

export type ThemeMessages = Record<string, Record<string, string>>;

export type ThemeDefinition = {
  slots: ThemeSlots;
  messages?: ThemeMessages;
};

export function defineTheme(theme: ThemeDefinition): ThemeDefinition {
  return theme;
}

type RuntimeSdk = {
  cn: (...inputs: unknown[]) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  assetUrl: (path: string) => string;
  navigate: (to: string) => void;
  useLocale: () => string;
};

function runtime(): RuntimeSdk {
  return (globalThis as { __COGM_THEME_SDK__?: RuntimeSdk }).__COGM_THEME_SDK__ as RuntimeSdk;
}

export function cn(...inputs: unknown[]): string {
  return runtime().cn(...inputs);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  return runtime().t(key, vars);
}

export function assetUrl(path: string): string {
  return runtime().assetUrl(path);
}

export function navigate(to: string): void {
  runtime().navigate(to);
}

export function useLocale(): string {
  return runtime().useLocale();
}

export type { SessionPhase, SessionStatus, ReactNode };
export type { ThemeManifest, ThemeId, ThemeVersion } from "@cogm/shared";
export { THEME_API_VERSION } from "@cogm/shared";