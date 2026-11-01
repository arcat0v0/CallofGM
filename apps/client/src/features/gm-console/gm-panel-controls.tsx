import { AudioLines, ChevronDown, FileText, Pause, Play, Repeat, RotateCcw, Settings2, ShieldBan, SkipForward, UserX, Users, VenetianMask, Volume2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { coc7e, type SessionSettings } from "@cogm/shared";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { BanPlayerDialog } from "@/features/gm-admin/dialogs/ban-player-dialog";
import { expressionLabel, formatClock, formatDurationMmSs, initialsOf } from "@/lib/format";
import { parseCocState, skillKeysFor } from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { t } from "@/i18n";
import { usePlayStore } from "@/stores/play-store";
import { SectionTitle } from "./gm-panel-stage";

export function CharactersSection() {
  const characters = usePlayStore((state) => state.characters);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-150">
      <SectionTitle icon={VenetianMask}>{t("gm.console.portraits")}</SectionTitle>
      {characters.map((char) => (
        <div key={char.characterId} className="flex items-center gap-2">
          <Avatar size="sm" className="bg-default">
            <AvatarFallback className="text-label-medium">{initialsOf(char.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-label-large">{char.name}</div>
            <div className="text-md-on-surface-variant text-label-small">{char.kind === "pc" ? "PC" : "NPC"}</div>
          </div>
          {char.portraits.length > 0 ? (
            <Select
              value={char.currentExpressionKey ?? char.portraits.find((item) => item.isDefault)?.expressionKey ?? ""}
              onValueChange={(value) => sendSessionCommand("expression:set", { characterId: char.characterId, expressionKey: value })}
            >
              <SelectTrigger className="h-[26px] w-[88px] px-2 text-label-small">
                <SelectValue placeholder={t("gm.console.unset")} />
                <ChevronDown className="size-3" />
              </SelectTrigger>
              <SelectContent>
                {char.portraits.map((portrait) => (
                  <SelectItem key={portrait.expressionKey} value={portrait.expressionKey}>
                    {expressionLabel(portrait.expressionKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button type="button" variant="tertiary" size="sm" disabled className="h-[26px] w-[88px] px-2 text-label-small">
              {t("gm.console.noPortrait")}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

export function AudioSection() {
  const bgm = usePlayStore((state) => state.bgm);
  const tracks = usePlayStore((state) => state.catalogTracks);
  const bgmTracks = tracks.filter((track) => track.type === "bgm");
  const soundEffects = tracks.filter((track) => track.type === "se");
  const current = bgmTracks.find((track) => track.id === bgm?.trackId);
  const durationMs = bgm?.durationMs ?? 0;
  const [now, setNow] = useState(() => Date.now());
  const [seekDraft, setSeekDraft] = useState<number | null>(null);

  useEffect(() => {
    setSeekDraft(null);
  }, [bgm?.version, bgm?.seekOffsetMs]);

  useEffect(() => {
    setNow(Date.now());
    if (!bgm?.playing || durationMs <= 0) {
      return;
    }
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [bgm?.playing, bgm?.startedAtMs, bgm?.version, durationMs]);

  let livePosition = 0;
  if (bgm) {
    livePosition = bgm.seekOffsetMs;
    if (bgm.playing) {
      livePosition += Math.max(0, now - bgm.startedAtMs);
    }
    if (durationMs > 0) {
      livePosition = bgm.loop ? livePosition % durationMs : Math.min(livePosition, durationMs);
    }
  }
  const displayPosition = seekDraft ?? livePosition;

  function sendBgm(action: "play" | "pause" | "volume" | "loop", extra: Record<string, unknown> = {}) {
    sendSessionCommand("audio:bgm", { action, expectedVersion: bgm?.version ?? 0, ...extra });
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-225">
      <SectionTitle icon={AudioLines}>{t("gm.console.audio")}</SectionTitle>
      {bgmTracks.map((track) => (
        <Button
          key={track.id}
          type="button"
          variant={track.id === bgm?.trackId ? "accentSoft" : "ghost"}
          className="h-7 justify-start px-2"
          onClick={() =>
            sendBgm("play", {
              trackId: track.id,
              ...(track.id === bgm?.trackId ? { restart: true } : {}),
            })
          }
        >
          {track.name}
        </Button>
      ))}
      <div className="bg-md-surface-container flex items-center gap-2 rounded-xl px-2.5 py-2.5">
        <Button type="button" variant="primary" size="icon-sm" className="size-7" aria-label={bgm?.playing ? t("gm.console.audioPause") : t("gm.console.audioPlay")} onClick={() => (bgm?.playing ? sendBgm("pause") : sendBgm("play", { trackId: bgm?.trackId ?? bgmTracks[0]?.id }))}>
          {bgm?.playing ? <Pause className="size-[13px]" /> : <Play className="size-[13px]" />}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-label-medium-emph">{current?.name ?? bgm?.name ?? t("gm.console.audioNone")}</div>
          <div className="text-md-on-surface-variant text-label-small">{bgm?.loop ? t("gm.console.audioLoopOn") : t("gm.console.audioLoopOff")} · v{bgm?.version ?? 0}</div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("gm.console.audioRestart")}
          disabled={!bgm?.trackId}
          onClick={() => {
            if (bgm?.trackId) {
              sendBgm("play", { trackId: bgm.trackId, restart: true });
            }
          }}
        >
          <RotateCcw />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("gm.console.audioLoop")} onClick={() => sendBgm("loop", { loop: !bgm?.loop })}><Repeat /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("gm.console.audioNext")} onClick={() => {
          const index = bgmTracks.findIndex((track) => track.id === bgm?.trackId);
          const next = bgmTracks[(index + 1) % Math.max(bgmTracks.length, 1)];
          if (next) sendBgm("play", { trackId: next.id });
        }}><SkipForward /></Button>
      </div>
      {durationMs > 0 ? (
        <div className="flex items-center gap-2.5">
          <span className="text-md-on-surface-variant w-10 text-label-small tabular-nums">{formatDurationMmSs(displayPosition)}</span>
          <Slider
            value={[displayPosition]}
            min={0}
            max={durationMs}
            size="sm"
            aria-label={t("gm.console.progressAria")}
            className="flex-1"
            onValueChange={(value) => setSeekDraft(value[0] ?? 0)}
            onValueCommit={(value) => {
              const seekOffsetMs = Math.round(value[0] ?? 0);
              setSeekDraft(seekOffsetMs);
              sendSessionCommand("audio:bgm", { action: "seek", seekOffsetMs, expectedVersion: bgm?.version ?? 0 });
            }}
          />
          <span className="text-md-on-surface-variant w-10 text-label-small tabular-nums">{formatDurationMmSs(durationMs)}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-2.5">
        <Volume2 className="size-[13px]" />
        <Slider value={[bgm?.volume ?? 0]} size="sm" aria-label={t("gm.console.volumeAria")} className="flex-1" onValueChange={(value) => sendBgm("volume", { volume: value[0] ?? 0 })} />
        <Button type="button" variant="tertiary" size="sm" className="h-6 px-2" onClick={() => sendBgm("volume", { volume: 80, transitionMs: 2500 })}>{t("gm.console.fadeIn")}</Button>
        <Button type="button" variant="tertiary" size="sm" className="h-6 px-2" onClick={() => sendBgm("volume", { volume: 0, transitionMs: 2500 })}>{t("gm.console.fadeOut")}</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {soundEffects.map((se) => (
          <Button key={se.id} type="button" variant="outline" size="sm" className="h-[26px] px-2.5" onClick={() => sendSessionCommand("audio:se", { trackId: se.id })}>
            <Zap className="text-warning size-[11px]" />
            {se.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function RulesSection() {
  const characters = usePlayStore((state) => state.characters);
  const [characterId, setCharacterId] = useState("");
  const [skillKey, setSkillKey] = useState(t("gm.console.defaultSkill"));
  const [difficulty, setDifficulty] = useState<"regular" | "hard" | "extreme">("regular");
  const [bonusDice, setBonusDice] = useState(0);
  const [penaltyDice, setPenaltyDice] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [sanLoss, setSanLoss] = useState("1/1d6");
  const [delta, setDelta] = useState("-1");
  const [maxValue, setMaxValue] = useState("10");
  const [tag, setTag] = useState("");
  const selected = characters.some((character) => character.characterId === characterId) ? characterId : "";
  const current = characters.find((character) => character.characterId === selected);
  const ready = Boolean(current);
  const state = parseCocState(current?.state);
  const skills = skillKeysFor(current);

  function sendStateEdit(payload: Record<string, unknown>) {
    if (!selected) {
      return;
    }
    sendSessionCommand("state:edit", { characterId: selected, ...payload });
  }

  function sendCheck(command: "check:perform" | "check:request") {
    if (!selected) {
      return;
    }
    sendSessionCommand(command, { characterId: selected, skillKey, difficulty, bonusDice, penaltyDice, ...(hidden ? { hidden: true } : {}) });
  }

  function sendSanCheck() {
    if (!selected) {
      return;
    }
    sendSessionCommand("check:san", { characterId: selected, sanLossExpression: sanLoss, ...(hidden ? { hidden: true } : {}) });
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-225">
      <SectionTitle icon={Zap}>{t("gm.console.rules")}</SectionTitle>
      <Select value={selected} onValueChange={setCharacterId}>
        <SelectTrigger className="h-8 text-label-medium" aria-label={t("gm.console.targetAria")}>
          <SelectValue placeholder={t("gm.console.targetPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {characters.map((character) => (
            <SelectItem key={character.characterId} value={character.characterId}>{character.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p
        data-rules-target={current?.characterId ?? ""}
        className={`text-label-small ${ready ? "text-md-on-surface-variant" : "text-warning"}`}
      >
        {current
          ? t("gm.console.currentTarget", {
              name: current.name,
              kind: current.kind === "pc" ? t("common.pc") : t("common.npc"),
            })
          : t("gm.console.noTarget")}
      </p>
      {state ? (
        <p className="text-md-on-surface-variant text-label-small">
          HP {state.hp}/{state.maxHp} · MP {state.mp}/{state.maxMp} · SAN {state.san}/{state.maxSan}
        </p>
      ) : null}
      <div className="flex gap-1.5">
        <Input value={delta} onChange={(event) => setDelta(event.target.value)} aria-label={t("gm.console.stateDelta")} className="h-8 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ hpDelta: Number(delta) || 0 })}>HP</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ mpDelta: Number(delta) || 0 })}>MP</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ sanDelta: Number(delta) || 0 })}>SAN</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Input value={maxValue} onChange={(event) => setMaxValue(event.target.value)} aria-label={t("gm.console.stateValue")} type="number" min={0} max={99} className="h-8 w-16 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ hp: Math.max(0, Number(maxValue) || 0) })}>{t("gm.console.writeHp")}</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ mp: Math.max(0, Number(maxValue) || 0) })}>{t("gm.console.writeMp")}</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ san: Math.max(0, Number(maxValue) || 0) })}>{t("gm.console.writeSan")}</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ maxHp: Math.max(1, Number(maxValue) || 1) })}>{t("gm.console.maxHp")}</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ maxMp: Math.max(0, Number(maxValue) || 0) })}>{t("gm.console.maxMp")}</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ maxSan: Math.max(0, Number(maxValue) || 0) })}>{t("gm.console.maxSan")}</Button>
      </div>
      <p className="text-md-on-surface-variant text-label-small">{t("gm.console.rangeHint")}</p>
      <div className="flex flex-wrap gap-1">
        {Object.entries(coc7e.CharacterStatusFlagLabel).map(([flag, label]) => {
          const on = Boolean(state?.statuses.some((item) => item === flag));
          return (
            <Button
              key={flag}
              type="button"
              size="sm"
              variant={on ? "dangerSoft" : "tertiary"}
              className="h-6 px-2"
              disabled={!ready}
              onClick={() => sendStateEdit(on ? { removeStatuses: [flag] } : { addStatuses: [flag] })}
            >
              {label}
            </Button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <Input value={tag} onChange={(event) => setTag(event.target.value)} placeholder={t("gm.console.tagPlaceholder")} className="h-8 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => {
          if (!tag.trim()) return;
          sendStateEdit({ addTags: [tag.trim()] });
          setTag("");
        }}>{t("gm.console.addTag")}</Button>
      </div>
      {state && state.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {state.tags.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              disabled={!ready}
              onClick={() => sendStateEdit({ removeTags: [item] })}
            >
              {item} ×
            </Button>
          ))}
        </div>
      ) : null}
      {state && (state.growthMarks.length > 0 || state.hiddenGrowthMarks.length > 0) ? (
        <p className="text-md-on-surface-variant text-label-small">
          {t("gm.console.growth", {
            marks: [
              ...state.growthMarks,
              ...state.hiddenGrowthMarks.map((mark) => t("gm.console.hiddenGrowth", { mark })),
            ].join(t("common.listSeparator")),
          })}
        </p>
      ) : null}
      <div className="flex gap-1.5">
        <Select value={skillKey} onValueChange={setSkillKey}>
          <SelectTrigger className="h-8 flex-1 text-label-medium"><SelectValue /></SelectTrigger>
          <SelectContent>
            {skills.map((skill) => (
              <SelectItem key={skill} value={skill}>{coc7e.coc7eSkillLabel(skill)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficulty} onValueChange={(value) => setDifficulty(value as typeof difficulty)}>
          <SelectTrigger className="h-8 w-[84px] text-label-medium"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["regular", "hard", "extreme"] as const).map((item) => (
              <SelectItem key={item} value={item}>{coc7e.CheckDifficultyLabel[item]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant={bonusDice ? "accentSoft" : "tertiary"} className="h-7" onClick={() => setBonusDice((n) => (n + 1) % 3)}>{t("dice.bonus", { count: bonusDice })}</Button>
        <Button type="button" size="sm" variant={penaltyDice ? "dangerSoft" : "tertiary"} className="h-7" onClick={() => setPenaltyDice((n) => (n + 1) % 3)}>{t("dice.penalty", { count: penaltyDice })}</Button>
        <Button type="button" size="sm" variant={hidden ? "dangerSoft" : "tertiary"} className="h-7" onClick={() => setHidden((value) => !value)}>{hidden ? t("dice.hidden") : t("dice.public")}</Button>
      </div>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendCheck("check:perform")}>{t("gm.console.checkShort")}</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendCheck("check:request")}>{t("gm.console.request")}</Button>
      </div>
      <div className="flex gap-1.5">
        <Input value={sanLoss} onChange={(event) => setSanLoss(event.target.value)} aria-label={t("gm.console.sanLossAria")} className="h-8 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={sendSanCheck}>{t("gm.console.sanCheck")}</Button>
      </div>
    </div>
  );
}

export function SessionSettingsSection() {
  const settings = usePlayStore((state) => state.settings);

  function update(patch: Partial<SessionSettings>) {
    sendSessionCommand("session:settings", { ...settings, ...patch });
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-75">
      <SectionTitle icon={Settings2}>{t("gm.console.settingsTitle")}</SectionTitle>
      <div className="bg-md-surface-container flex items-center justify-between gap-2 rounded-xl px-3 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground text-label-large">{t("gm.console.sharePcSheets")}</span>
          <span className="text-md-on-surface-variant text-label-small">{t("gm.console.sharePcSheetsDescription")}</span>
        </div>
        <Switch
          size="sm"
          aria-label={t("gm.console.sharePcSheets")}
          checked={settings.sharePcSheets}
          onCheckedChange={(checked) => update({ sharePcSheets: Boolean(checked) })}
        />
      </div>
      <div className="bg-md-surface-container flex items-center justify-between gap-2 rounded-xl px-3 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground text-label-large">{t("gm.console.obSeePcState")}</span>
          <span className="text-md-on-surface-variant text-label-small">{t("gm.console.obSeePcStateDescription")}</span>
        </div>
        <Switch
          size="sm"
          aria-label={t("gm.console.obSeePcState")}
          checked={settings.obSeePcState}
          onCheckedChange={(checked) => update({ obSeePcState: Boolean(checked) })}
        />
      </div>
    </div>
  );
}

export function HandoutSection() {
  const handouts = usePlayStore((state) => state.catalogHandouts);
  const granted = usePlayStore((state) => state.handouts);
  const characters = usePlayStore((state) => state.characters).filter((character) => character.kind === "pc");
  const [secretIds, setSecretIds] = useState<string[]>([]);
  const recipients = characters.filter((character) => secretIds.includes(character.characterId));
  const recipientNames = recipients.map((character) => character.name).join("、");

  function toggleSecret(characterId: string) {
    setSecretIds((current) => current.includes(characterId)
      ? current.filter((id) => id !== characterId)
      : [...current, characterId]);
  }

  function dispatchSecret(command: "handout:grant" | "handout:append", payload: Record<string, unknown>) {
    if (recipients.length === 0) {
      toast.error(t("gm.console.noRecipient"));
      return;
    }
    sendSessionCommand(command, { ...payload, recipientCharacterIds: recipients.map((character) => character.characterId) });
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-225">
      <SectionTitle icon={FileText}>{t("gm.console.handoutTitle")}</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {characters.map((character) => (
          <Button
            key={character.characterId}
            type="button"
            size="sm"
            variant={secretIds.includes(character.characterId) ? "accentSoft" : "tertiary"}
            aria-pressed={secretIds.includes(character.characterId)}
            className="h-6 px-2"
            onClick={() => toggleSecret(character.characterId)}
          >
            {character.name}
          </Button>
        ))}
      </div>
      <p
        data-secret-recipients={recipients.map((character) => character.characterId).join(",")}
        className={`text-label-small ${recipients.length > 0 ? "text-md-on-surface-variant" : "text-warning"}`}
      >
        {recipients.length > 0
          ? t("gm.console.secretRecipients", { names: recipientNames })
          : t("gm.console.noRecipients")}
      </p>
      {handouts.map((handout) => (
        <div key={handout.id} className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-label-medium">{handout.title}</span>
          <Button
            type="button"
            size="sm"
            variant="tertiary"
            className="h-7"
            onClick={() => sendSessionCommand("handout:grant", { handoutId: handout.id, recipientCharacterIds: [] })}
          >
            {t("gm.console.public")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="tertiary"
            className="h-7"
            disabled={recipients.length === 0}
            onClick={() => dispatchSecret("handout:grant", { handoutId: handout.id })}
          >
            {t("gm.console.secret")}
          </Button>
        </div>
      ))}
      {granted.map((item) => (
        <div key={item.grantId} className="text-md-on-surface-variant flex items-center gap-1.5 text-label-small">
          <span className="min-w-0 flex-1 truncate">{item.handout.title}</span>
          <Badge variant="soft" size="sm">{item.isPublic ? t("gm.console.public") : t("gm.console.secret")}</Badge>
          {!item.isPublic ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              disabled={recipients.length === 0}
              onClick={() => dispatchSecret("handout:append", { grantId: item.grantId })}
            >
              {t("gm.console.append")}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function OnlineSection() {
  const presence = usePlayStore((state) => state.presence);
  const kickedPlayers = usePlayStore((state) => state.kickedPlayers);
  const characters = usePlayStore((state) => state.characters);
  const [banPlayerId, setBanPlayerId] = useState<string | null>(null);
  const banTarget = presence.find((player) => player.playerId === banPlayerId);
  const banName = characters.find((character) => character.characterId === banTarget?.characterId)?.name ?? banTarget?.playerId.slice(0, 8);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-225">
      <SectionTitle icon={Users}>{t("gm.console.onlineTitle", { count: presence.length })}</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {presence.map((player) => {
          const claimed = characters.find((character) => character.characterId === player.characterId);
          const name = claimed?.name ?? player.playerId.slice(0, 8);
          return (
            <div key={player.playerId} className="flex items-center gap-2">
              <span className="bg-success size-[7px] shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-foreground truncate font-sans text-label-large">{name}</span>
                <span className="text-md-on-surface-variant font-mono text-label-small">{player.playerId.slice(0, 8)}</span>
              </div>
              <Badge variant="soft" tone="accent" size="sm" className="shrink-0">
                {player.role === "ob" ? t("common.ob") : t("common.pc")}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("gm.console.kickAria", { name })}
                className="text-danger-soft-foreground size-7 shrink-0"
                onClick={() => sendSessionCommand("player:kick", { playerId: player.playerId })}
              >
                <UserX className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("gm.console.banAria", { name })}
                className="text-md-on-surface-variant size-7 shrink-0"
                onClick={() => setBanPlayerId(player.playerId)}
              >
                <ShieldBan className="size-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
      <SectionTitle icon={UserX}>{t("gm.console.kickedTitle", { count: kickedPlayers.length })}</SectionTitle>
      {kickedPlayers.length === 0 ? (
        <p className="text-md-on-surface-variant text-label-small">{t("gm.console.noKicked")}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {kickedPlayers.map((kicked) => {
            const name = kicked.displayName ?? kicked.playerId.slice(0, 8);
            return (
              <div key={kicked.playerId} className="flex items-center gap-2">
                <span className="bg-danger size-[7px] shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-foreground truncate font-sans text-label-large">{name}</span>
                  <span className="text-md-on-surface-variant truncate text-label-small">
                    {formatClock(kicked.createdAt)}
                    {kicked.reason ? ` · ${kicked.reason}` : ""}
                  </span>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="accentSoft"
                  className="shrink-0"
                  onClick={() => sendSessionCommand("player:unkick", { playerId: kicked.playerId })}
                >
                  {t("gm.console.unkick")}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <BanPlayerDialog
        open={banPlayerId !== null}
        onOpenChange={(open) => {
          if (!open) setBanPlayerId(null);
        }}
        playerName={banName}
        roleLabel={banTarget?.role === "ob" ? t("common.ob") : t("common.player")}
        defaultPlayerId={banPlayerId ?? ""}
        onBan={(input) => {
          sendSessionCommand("player:ban", {
            playerId: input.playerId,
            reason: input.reason,
            ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
          });
        }}
      />
    </div>
  );
}
