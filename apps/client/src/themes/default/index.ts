import { defineTheme } from "@cogm/theme-sdk";
import { GmAdminNav } from "./slots/gm-admin-nav";
import { GmAdminShell } from "./slots/gm-admin-shell";
import { GmConsoleLayout } from "./slots/gm-console-layout";
import { GmConsoleStage } from "./slots/gm-console-stage";
import { JoinHeader } from "./slots/join-header";
import { JoinLayout } from "./slots/join-layout";
import { JoinSeatCard } from "./slots/join-seat-card";
import { PlayChatMessage } from "./slots/play-chat-message";
import { PlayChatPanel } from "./slots/play-chat-panel";
import { PlayDialogue } from "./slots/play-dialogue";
import { PlayHistory } from "./slots/play-history";
import { PlayLayout } from "./slots/play-layout";
import { PlaySceneInfo } from "./slots/play-scene-info";
import { PlayStage } from "./slots/play-stage";

export const defaultTheme = defineTheme({
	slots: {
		"gm-admin.shell": GmAdminShell,
		"gm-admin.nav": GmAdminNav,
		"gm-console.layout": GmConsoleLayout,
		"gm-console.stage": GmConsoleStage,
		"join.layout": JoinLayout,
		"join.header": JoinHeader,
		"join.seat-card": JoinSeatCard,
		"play.layout": PlayLayout,
		"play.stage": PlayStage,
		"play.scene-info": PlaySceneInfo,
		"play.dialogue": PlayDialogue,
		"play.chat-panel": PlayChatPanel,
		"play.chat-message": PlayChatMessage,
		"play.history": PlayHistory,
	},
});
