import { AudioLines, ChevronDown, FileText, Pause, Play, Repeat, Settings2, ShieldBan, SkipForward, UserX, Users, VenetianMask, Volume2, Zap } from "lucide-react";
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
import { expressionLabel, formatDurationMmSs, initialsOf } from "@/lib/format";
import { parseCocState, skillKeysFor } from "@/lib/coc-live";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { SectionTitle } from "./gm-panel-stage";

export function CharactersSection() {
  const characters = usePlayStore((state) => state.characters);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-150">
      <SectionTitle icon={VenetianMask}>立绘控制</SectionTitle>
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
                <SelectValue placeholder="未设置" />
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
              无立绘
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
      <SectionTitle icon={AudioLines}>音频 · GM 全局控制</SectionTitle>
      {bgmTracks.map((track) => (
        <Button key={track.id} type="button" variant={track.id === bgm?.trackId ? "accentSoft" : "ghost"} className="h-7 justify-start px-2" onClick={() => sendBgm("play", { trackId: track.id })}>
          {track.name}
        </Button>
      ))}
      <div className="bg-md-surface-container flex items-center gap-2 rounded-xl px-2.5 py-2.5">
        <Button type="button" variant="primary" size="icon-sm" className="size-7" aria-label={bgm?.playing ? "暂停" : "播放"} onClick={() => (bgm?.playing ? sendBgm("pause") : sendBgm("play", { trackId: bgm?.trackId ?? bgmTracks[0]?.id }))}>
          {bgm?.playing ? <Pause className="size-[13px]" /> : <Play className="size-[13px]" />}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-label-medium-emph">{current?.name ?? bgm?.name ?? "未选择曲目"}</div>
          <div className="text-md-on-surface-variant text-label-small">{bgm?.loop ? "循环" : "单曲"} · v{bgm?.version ?? 0}</div>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="循环" onClick={() => sendBgm("loop", { loop: !bgm?.loop })}><Repeat /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="下一首" onClick={() => {
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
            aria-label="播放进度"
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
        <Slider value={[bgm?.volume ?? 0]} size="sm" aria-label="音量" className="flex-1" onValueChange={(value) => sendBgm("volume", { volume: value[0] ?? 0 })} />
        <Button type="button" variant="tertiary" size="sm" className="h-6 px-2" onClick={() => sendBgm("volume", { volume: 80, transitionMs: 2500 })}>淡入</Button>
        <Button type="button" variant="tertiary" size="sm" className="h-6 px-2" onClick={() => sendBgm("volume", { volume: 0, transitionMs: 2500 })}>淡出</Button>
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
  const [skillKey, setSkillKey] = useState("侦查");
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
      <SectionTitle icon={Zap}>规则 · 状态 / 鉴定 / SAN</SectionTitle>
      <Select value={selected} onValueChange={setCharacterId}>
        <SelectTrigger className="h-8 text-label-medium" aria-label="目标角色">
          <SelectValue placeholder="选择目标角色" />
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
        {current ? `当前目标：${current.name} · ${current.kind === "pc" ? "PC" : "NPC"}` : "未选择角色 · 状态编辑、鉴定与 SAN 检定已禁用"}
      </p>
      {state ? (
        <p className="text-md-on-surface-variant text-label-small">
          HP {state.hp}/{state.maxHp} · MP {state.mp}/{state.maxMp} · SAN {state.san}/{state.maxSan}
        </p>
      ) : null}
      <div className="flex gap-1.5">
        <Input value={delta} onChange={(event) => setDelta(event.target.value)} aria-label="数值增减" className="h-8 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ hpDelta: Number(delta) || 0 })}>HP</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ mpDelta: Number(delta) || 0 })}>MP</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ sanDelta: Number(delta) || 0 })}>SAN</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Input value={maxValue} onChange={(event) => setMaxValue(event.target.value)} aria-label="写入数值" className="h-8 w-16 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ hp: Math.max(0, Number(maxValue) || 0) })}>写HP</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ mp: Math.max(0, Number(maxValue) || 0) })}>写MP</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ san: Math.max(0, Number(maxValue) || 0) })}>写SAN</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ maxHp: Math.max(1, Number(maxValue) || 1) })}>HP上限</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ maxMp: Math.max(0, Number(maxValue) || 0) })}>MP上限</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendStateEdit({ maxSan: Math.max(0, Number(maxValue) || 0) })}>SAN上限</Button>
      </div>
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
        <Input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="自定义标签" className="h-8 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => {
          if (!tag.trim()) return;
          sendStateEdit({ addTags: [tag.trim()] });
          setTag("");
        }}>挂标签</Button>
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
          成长：{[...state.growthMarks, ...state.hiddenGrowthMarks.map((mark) => `暗骰·${mark}`)].join("、")}
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
        <Button type="button" size="sm" variant={bonusDice ? "accentSoft" : "tertiary"} className="h-7" onClick={() => setBonusDice((n) => (n + 1) % 3)}>奖励 {bonusDice}</Button>
        <Button type="button" size="sm" variant={penaltyDice ? "dangerSoft" : "tertiary"} className="h-7" onClick={() => setPenaltyDice((n) => (n + 1) % 3)}>惩罚 {penaltyDice}</Button>
        <Button type="button" size="sm" variant={hidden ? "dangerSoft" : "tertiary"} className="h-7" onClick={() => setHidden((value) => !value)}>{hidden ? "暗骰" : "公开"}</Button>
      </div>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendCheck("check:perform")}>鉴定</Button>
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={() => sendCheck("check:request")}>请求</Button>
      </div>
      <div className="flex gap-1.5">
        <Input value={sanLoss} onChange={(event) => setSanLoss(event.target.value)} aria-label="SAN 损失" className="h-8 text-label-medium" />
        <Button type="button" size="sm" variant="tertiary" className="h-8" disabled={!ready} onClick={sendSanCheck}>SAN 检定</Button>
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
      <SectionTitle icon={Settings2}>团设置 · 可见性</SectionTitle>
      <div className="bg-md-surface-container flex items-center justify-between gap-2 rounded-xl px-3 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground text-label-large">公开队友人物卡</span>
          <span className="text-md-on-surface-variant text-label-small">开启后玩家与 OB 都能查看全部 PC 人物卡；NPC 仅 GM 可见</span>
        </div>
        <Switch
          size="sm"
          aria-label="公开队友人物卡"
          checked={settings.sharePcSheets}
          onCheckedChange={(checked) => update({ sharePcSheets: Boolean(checked) })}
        />
      </div>
      <div className="bg-md-surface-container flex items-center justify-between gap-2 rounded-xl px-3 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground text-label-large">OB 可见 PC 数值</span>
          <span className="text-md-on-surface-variant text-label-small">关闭后观战位看不到任何 PC 的 HP / MP / SAN</span>
        </div>
        <Switch
          size="sm"
          aria-label="OB 可见 PC 数值"
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
      toast.error("请先选择情报接收的 PC");
      return;
    }
    sendSessionCommand(command, { ...payload, recipientCharacterIds: recipients.map((character) => character.characterId) });
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-225">
      <SectionTitle icon={FileText}>情报 · 公开 / 秘密发放</SectionTitle>
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
        {recipients.length > 0 ? `秘密接收：${recipientNames}` : "未选择接收 PC · 「秘密」与「追加」已禁用"}
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
            公开
          </Button>
          <Button
            type="button"
            size="sm"
            variant="tertiary"
            className="h-7"
            disabled={recipients.length === 0}
            onClick={() => dispatchSecret("handout:grant", { handoutId: handout.id })}
          >
            秘密
          </Button>
        </div>
      ))}
      {granted.map((item) => (
        <div key={item.grantId} className="text-md-on-surface-variant flex items-center gap-1.5 text-label-small">
          <span className="min-w-0 flex-1 truncate">{item.handout.title}</span>
          <Badge variant="soft" size="sm">{item.isPublic ? "公开" : "秘密"}</Badge>
          {!item.isPublic ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              disabled={recipients.length === 0}
              onClick={() => dispatchSecret("handout:append", { grantId: item.grantId })}
            >
              追加
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function OnlineSection() {
  const presence = usePlayStore((state) => state.presence);
  const characters = usePlayStore((state) => state.characters);
  const [banPlayerId, setBanPlayerId] = useState<string | null>(null);
  const banTarget = presence.find((player) => player.playerId === banPlayerId);
  const banName = characters.find((character) => character.characterId === banTarget?.characterId)?.name ?? banTarget?.playerId.slice(0, 8);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 ease-standard-default-spatial flex flex-col gap-2.5 px-4 py-3 duration-500 delay-225">
      <SectionTitle icon={Users}>在线玩家 · {presence.length}</SectionTitle>
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
                {player.role === "ob" ? "OB" : "PC"}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`踢出 ${name}`}
                className="text-danger-soft-foreground size-7 shrink-0"
                onClick={() => sendSessionCommand("player:kick", { playerId: player.playerId })}
              >
                <UserX className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`拉黑 ${name}`}
                className="text-md-on-surface-variant size-7 shrink-0"
                onClick={() => setBanPlayerId(player.playerId)}
              >
                <ShieldBan className="size-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
      <BanPlayerDialog
        open={banPlayerId !== null}
        onOpenChange={(open) => {
          if (!open) setBanPlayerId(null);
        }}
        playerName={banName}
        roleLabel={banTarget?.role === "ob" ? "OB" : "玩家"}
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
