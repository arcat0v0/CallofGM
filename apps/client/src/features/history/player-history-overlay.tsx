import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronDown, Search, Users, X } from "lucide-react";
import type { PlayHistoryCtx } from "@cogm/theme-sdk";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChatMessageCard } from "@/features/chat/chat-message-card";
import { t } from "@/i18n";

function PlayerHistoryOverlay({
  open,
  onClose,
  messages,
  selfName,
  hasOlder,
  loadingOlder,
  onLoadOlder,
}: PlayHistoryCtx) {
  const [query, setQuery] = useState("");
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottom = useRef(true);
  const previousLastId = useRef<string | undefined>(undefined);

  const allSpeakers = useMemo(() => {
    const names: string[] = [];
    for (const message of messages) {
      if (message.pending || message.rejected) {
        continue;
      }
      if (!names.includes(message.speakerName)) {
        names.push(message.speakerName);
      }
    }
    return names;
  }, [messages]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return messages.filter((message) => {
      if (message.pending || message.rejected) {
        return false;
      }
      if (speakers.length > 0 && !speakers.includes(message.speakerName)) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return (
        message.body.toLowerCase().includes(keyword) ||
        message.speakerName.toLowerCase().includes(keyword)
      );
    });
  }, [messages, query, speakers]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      previousLastId.current = undefined;
      atBottom.current = true;
      setHasNew(false);
      return;
    }
    atBottom.current = true;
    setHasNew(false);
    previousLastId.current = messages[messages.length - 1]?.id;
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const lastId = messages[messages.length - 1]?.id;
    const changed = previousLastId.current !== lastId;
    if (changed && !atBottom.current) {
      setHasNew(true);
    }
    previousLastId.current = lastId;
    if (changed && atBottom.current) {
      const container = scrollRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [open, messages]);

  function scrollToLatest() {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    atBottom.current = true;
    setHasNew(false);
  }

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    const bottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 48;
    atBottom.current = bottom;
    if (bottom) {
      setHasNew(false);
    }
  }

  function toggleSpeaker(name: string) {
    setSpeakers((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  }

  if (!open) {
    return null;
  }

  return (
    <div className="bg-background/85 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("history.title")}
        className="bg-md-surface-container border-md-outline-variant/40 shadow-modal flex h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-modal border"
      >
        <header className="border-separator-secondary flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
          <h2 className="text-foreground shrink-0 font-serif text-title-medium-emph">
            {t("history.title")}
          </h2>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <InputGroup className="h-9 w-48">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                aria-label={t("history.search")}
                placeholder={t("history.search")}
                className="text-label-medium"
                onChange={(event) => setQuery(event.target.value)}
              />
            </InputGroup>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  className="h-9 gap-2 rounded-full px-3 text-label-medium"
                >
                  <Users className="size-4" />
                  {t("history.speakers")}
                  {speakers.length > 0 ? (
                    <span className="bg-accent text-accent-foreground grid size-5 place-items-center rounded-full text-label-small">
                      {speakers.length}
                    </span>
                  ) : null}
                  <ChevronDown className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                {allSpeakers.length === 0 ? (
                  <p className="text-md-on-surface-variant px-2 py-1.5 text-label-medium">
                    {t("history.empty")}
                  </p>
                ) : (
                  <div className="flex max-h-72 flex-col overflow-y-auto">
                    {allSpeakers.map((name) => (
                      <label
                        key={name}
                        className="hover:bg-md-on-surface/5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5"
                      >
                        <Checkbox
                          checked={speakers.includes(name)}
                          onCheckedChange={() => toggleSpeaker(name)}
                        />
                        <span className="text-md-on-surface min-w-0 flex-1 truncate text-label-medium">
                          {name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {speakers.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-8 w-full"
                    onClick={() => setSpeakers([])}
                  >
                    {t("history.clearSpeakers")}
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="tonal"
              size="sm"
              className="h-9"
              onClick={scrollToLatest}
            >
              {t("history.backToLatest")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("history.close")}
              title={t("history.close")}
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
          >
            {hasOlder ? (
              <div className="flex shrink-0 justify-center">
                <Button
                  type="button"
                  variant="tonal"
                  size="xs"
                  className="h-8 px-3.5 text-label-medium"
                  disabled={loadingOlder}
                  onClick={onLoadOlder}
                >
                  {loadingOlder ? t("common.loading") : t("history.loadOlder")}
                </Button>
              </div>
            ) : null}
            {filtered.length === 0 ? (
              <p className="text-md-on-surface-variant py-8 text-center text-body-medium">
                {t("history.empty")}
              </p>
            ) : (
              filtered.map((message) => (
                <ChatMessageCard
                  key={message.id}
                  message={message}
                  self={message.speakerName === selfName}
                />
              ))
            )}
          </div>
          {hasNew ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="shadow-overlay pointer-events-auto h-9 gap-1.5 rounded-full px-3.5"
                onClick={scrollToLatest}
              >
                <ArrowDown className="size-4" />
                {t("history.newMessages")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { PlayerHistoryOverlay };
