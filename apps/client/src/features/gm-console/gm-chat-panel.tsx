import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, ChevronDown, Dices, EyeOff, MessagesSquare, Paperclip, Search, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { MessageList } from "@/features/chat/message-list";
import type { ChatMessage } from "@/features/chat/types";
import { DiceTray } from "@/features/session-live/dice-tray";
import { sendSessionCommand } from "@/lib/session-socket";
import { cn } from "@/lib/utils";
import { usePlayStore } from "@/stores/play-store";
import { sessionStatusLabel } from "@/i18n/labels";
import { t } from "@/i18n";
import { gmFloatingCard } from "./gm-styles";
import { useGmTool } from "./gm-tool-context";

type Channel = "all" | "ic" | "ooc";
type MessageMode = "roleplay" | "ooc";

const CHANNEL_LABELS: Record<Channel, string> = {
  all: "gm.workbench.channelAll",
  ic: "gm.workbench.channelIc",
  ooc: "gm.workbench.channelOoc",
};

function GmMessageCard({ message }: { message: ChatMessage }) {
  if (message.isSystem) {
    const accent = message.hidden
      ? "text-warning border-l-warning"
      : message.outcome === "failure"
        ? "text-danger border-l-danger"
        : message.outcome === "success"
          ? "text-md-primary border-l-md-primary"
          : "text-md-on-surface-variant border-l-md-outline";
    const target = message.body.match(/（目标值\s*([^）]+)）$/);
    const body = (target ? message.body.slice(0, target.index ?? 0).trimEnd() : message.body).replace(
      / → SAN (\S+)$/,
      "\u00A0→\u00A0SAN\u00A0$1",
    );
    return (
      <div className={cn("bg-md-surface-container-high border border-md-outline-variant/40 flex flex-col gap-2 rounded-lg border-l-2 p-3.5", accent)}>
        <div className="flex items-center gap-2">
          {message.hidden ? <EyeOff className="size-4 shrink-0" /> : <Dices className="size-4 shrink-0" />}
          <span className="min-w-0 flex-1 truncate text-label-medium">
            {message.speakerName} · {message.speakerRoleLabel}
          </span>
          <span className="text-md-outline shrink-0 font-mono text-label-small">{message.time}</span>
        </div>
        <p className="text-md-on-surface whitespace-pre-wrap text-pretty break-words font-sans text-body-medium font-semibold">
          {body}
        </p>
        {target ? (
          <span className="text-md-outline font-mono text-label-small">{t("gm.workbench.targetValue", { value: target[1] ?? "" })}</span>
        ) : null}
        {message.hidden ? (
          <span className="text-md-on-surface-variant text-label-small">{t("gm.workbench.privateRoll")}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <Avatar size="sm" className={cn("size-7 shrink-0", message.avatarBg)}>
        <AvatarFallback className={cn("text-label-small", message.avatarFg)}>
          {message.avatarInitials}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-md-on-surface text-label-medium-emph">{message.speakerName}</span>
          {message.tone === "ooc" ? (
            <Badge variant="soft" tone="default" size="sm">
              {t("chat.ooc")}
            </Badge>
          ) : null}
          <span className="text-md-outline font-mono text-label-small">{message.time}</span>
        </div>
        <p className="text-md-on-surface-variant whitespace-pre-wrap break-words text-body-medium">
          {message.body}
        </p>
      </div>
    </div>
  );
}

function GmChatPanel({ className }: { className?: string }) {
  const [channel, setChannel] = useState<Channel>("all");
  const [mode, setMode] = useState<MessageMode>("roleplay");
  const [draft, setDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const messages = usePlayStore((state) => state.messages);
  const status = usePlayStore((state) => state.status);
  const historyHasMore = usePlayStore((state) => state.historyHasMore);
  const historyLoading = usePlayStore((state) => state.historyLoading);
  const historyPagesLoaded = usePlayStore((state) => state.historyPagesLoaded);
  const loadOlderHistory = usePlayStore((state) => state.loadOlderHistory);
  const firstPcId = usePlayStore((state) => state.characters.find((character) => character.kind === "pc")?.characterId);
  const { openTool } = useGmTool();
  const ended = status === "ended";
  const visible = useMemo(() => {
    const byChannel =
      channel === "ic"
        ? messages.filter((message) => message.tone !== "ooc")
        : channel === "ooc"
          ? messages.filter((message) => message.tone === "ooc")
          : messages;
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return byChannel;
    }
    return byChannel.filter(
      (message) =>
        message.body.toLowerCase().includes(keyword) ||
        message.speakerName.toLowerCase().includes(keyword),
    );
  }, [channel, messages, query]);

  function handleSend() {
    const content = draft.trim();
    if (!content || ended) {
      return;
    }
    const sent = sendSessionCommand("chat:send", {
      channel: mode === "ooc" ? "ooc" : "roleplay",
      content,
    });
    if (!sent) {
      toast.error(t("chat.notConnected"));
      return;
    }
    setDraft("");
  }

  return (
    <div
      className={cn(
        gmFloatingCard,
        "animate-in fade-in flex h-full min-h-0 flex-col gap-4 rounded-xl p-3.5 duration-500",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="text-md-on-surface text-title-medium-emph">{t("gm.workbench.chatTitle")}</span>
        <span className="text-md-on-surface-variant text-label-medium">
          {ended && status ? sessionStatusLabel(status) : t("gm.workbench.realtime")}
        </span>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="tertiary" size="sm" className="bg-md-surface-container-high/80 border border-md-outline-variant/50 h-9 gap-2 rounded-full px-3.5">
              <MessagesSquare className="size-4" />
              {t(CHANNEL_LABELS[channel])}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuRadioGroup value={channel} onValueChange={(value) => setChannel(value as Channel)}>
              {(Object.keys(CHANNEL_LABELS) as Channel[]).map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {t(CHANNEL_LABELS[key])}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="tertiary"
          size="icon-sm"
          className="bg-md-surface-container-high/80 border border-md-outline-variant/50 text-md-on-surface-variant size-9"
          aria-label={t("gm.workbench.searchChat")}
          aria-pressed={searchOpen}
          onClick={() => {
            setSearchOpen((value) => !value);
            if (searchOpen) {
              setQuery("");
            }
          }}
        >
          {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
        </Button>
      </div>

      {searchOpen ? (
        <InputGroup className="h-9 shrink-0">
          <InputGroupAddon className="[&_svg]:size-5">
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            aria-label={t("gm.workbench.searchChat")}
            placeholder={t("gm.workbench.searchChat")}
            className="text-label-medium"
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
      ) : null}

      {visible.length === 0 && !historyHasMore ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <MessagesSquare className="text-md-on-surface-variant/35 size-6" />
          <p className="text-md-on-surface-variant/85 text-label-medium">{t("gm.workbench.chatEmpty")}</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <MessageList
            messages={visible}
            showRoleBadge={false}
            onLoadOlder={loadOlderHistory}
            hasOlderHistory={historyHasMore}
            loadingOlder={historyLoading}
            olderLoads={historyPagesLoaded}
            renderMessage={(message) => <GmMessageCard message={message} />}
            stickToBottom
            className="min-h-0 max-h-full gap-4 overflow-y-auto pr-0.5"
          />
        </div>
      )}

      <div className="bg-md-surface-container-high/80 border border-md-outline-variant/40 flex shrink-0 flex-col gap-2.5 rounded-3xl p-3">
        <div className="flex items-center justify-between gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-accent flex items-center gap-1 rounded-sm text-label-medium outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/50"
              >
                {t("common.gmShort")} · {mode === "ooc" ? t("chat.ooc") : t("gm.workbench.narration")}
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuRadioGroup value={mode} onValueChange={(value) => setMode(value as MessageMode)}>
                <DropdownMenuRadioItem value="roleplay">{t("gm.workbench.narration")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ooc">{t("chat.ooc")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Textarea
          value={draft}
          aria-label={t("gm.workbench.composerPlaceholder")}
          placeholder={ended ? t("chat.endedPlaceholder") : t("gm.workbench.composerPlaceholder")}
          rows={2}
          disabled={ended}
          className="text-md-on-surface placeholder:text-md-on-surface-variant/80 min-h-9 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-body-medium hover:bg-transparent focus-visible:border-transparent disabled:opacity-60"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              handleSend();
            }
          }}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-md-on-surface-variant size-8"
                  aria-label={t("chat.diceAria")}
                  disabled={ended}
                >
                  <Dices className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="bg-md-surface-container-high w-80">
                <DiceTray gm characterId={firstPcId} disabled={ended} />
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-md-on-surface-variant size-8"
              aria-label={t("gm.workbench.openHandouts")}
              disabled={ended}
              onClick={() => openTool("handouts")}
            >
              <Paperclip className="size-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="primary"
            size="icon-sm"
            className="size-9"
            aria-label={t("gm.workbench.sendNarration")}
            disabled={ended || draft.trim().length === 0}
            onClick={handleSend}
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { GmChatPanel };