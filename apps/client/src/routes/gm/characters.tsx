import { createFileRoute } from "@tanstack/react-router";
import {
  Brain,
  Clover,
  FileSpreadsheet,
  Footprints,
  HeartPulse,
  type LucideIcon,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";
import {
  type CharacterKind,
  type DerivedStats,
  type GameCharacter,
  characters,
} from "@/features/gm-admin/characters/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/characters")({
  component: GmCharactersPage,
});

type Filter = "all" | "PC" | "NPC";

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function GmCharactersPage() {
  const [selectedId, setSelectedId] = useState(characters[0]!.id);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const counts = useMemo(
    () => ({
      all: characters.length,
      PC: characters.filter((c) => c.kind === "PC").length,
      NPC: characters.filter((c) => c.kind === "NPC").length,
    }),
    [],
  );

  const visible = useMemo(() => {
    const q = query.trim();
    return characters.filter((c) => {
      const matchesKind = filter === "all" || c.kind === filter;
      const matchesQuery = q === "" || c.name.includes(q);
      return matchesKind && matchesQuery;
    });
  }, [filter, query]);

  const selected = characters.find((c) => c.id === selectedId) ?? characters[0]!;

  return (
    <AdminLayout active="characters">
      <div className="-mx-8 -my-7 flex h-screen overflow-hidden">
        <CharList
          items={visible}
          counts={counts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          onNew={() => setImportOpen(true)}
        />
        <CharDetail character={selected} onImport={() => setImportOpen(true)} onDelete={() => setDeleteOpen(true)} />
      </div>

      <ImportCharacterSheetDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        icon={Trash2}
        confirmIcon={Trash2}
        title="删除人物"
        description={`确定要删除「${selected.name}」吗？该人物的数值卡与立绘将一并移除，此操作不可撤销。`}
        confirmLabel="删除"
        onConfirm={() => setDeleteOpen(false)}
      />
    </AdminLayout>
  );
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "PC", label: "PC" },
  { key: "NPC", label: "NPC" },
];

function CharList({
  items,
  counts,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  onNew,
}: {
  items: GameCharacter[];
  counts: Record<Filter, number>;
  selectedId: string;
  onSelect: (id: string) => void;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onNew: () => void;
}) {
  return (
    <aside className="bg-background-secondary border-separator flex w-80 shrink-0 flex-col border-r">
      <div className="flex flex-col gap-3 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-foreground font-serif text-lg font-bold">人物</h1>
          <Button
            type="button"
            onClick={onNew}
            variant="primaryGradient"
            size="sm"
            className="h-[30px] px-3 text-xs font-semibold"
          >
            <Plus />
            新建
          </Button>
        </div>

        <InputGroup className="h-9 rounded-[10px] border-separator-secondary">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索人物…"
            aria-label="搜索人物"
            className="text-[13px]"
          />
        </InputGroup>

        <SegmentedControl
          value={filter}
          options={FILTERS.map((item) => ({
            value: item.key,
            label: `${item.label} ${counts[item.key]}`,
          }))}
          onValueChange={onFilterChange}
          className="gap-1.5 bg-transparent p-0"
          itemClassName="h-[26px] rounded-full border border-separator-secondary data-[state=on]:border-transparent"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2.5 pt-1 pb-2.5">
        {items.map((character) => (
          <CharListItem
            key={character.id}
            character={character}
            selected={character.id === selectedId}
            onSelect={() => onSelect(character.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function CharListItem({
  character,
  selected,
  onSelect,
}: {
  character: GameCharacter;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onSelect}
      variant="ghost"
      aria-pressed={selected}
      className={cn(
        "h-auto w-full justify-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left whitespace-normal",
        selected ? "bg-default hover:bg-default" : "hover:bg-surface-hover/40",
      )}
    >
      <Avatar
        size="sm"
        className={selected ? "bg-accent text-accent-foreground" : "bg-default text-foreground"}
      >
        <AvatarFallback className="bg-transparent font-serif font-bold">{character.initial}</AvatarFallback>
      </Avatar>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span className="text-foreground truncate font-sans text-[13px] font-semibold">{character.name}</span>
        <span className="text-foreground-tertiary truncate font-sans text-[11px]">
          {character.profession ? `${character.profession} · ${character.kind}` : character.kind}
        </span>
      </div>
      <KindBadge kind={character.kind} />
    </Button>
  );
}

function KindBadge({ kind }: { kind: CharacterKind }) {
  return (
    <Badge tone={kind === "PC" ? "accent" : "default"} variant="soft" size="sm">
      {kind}
    </Badge>
  );
}

function CharDetail({
  character,
  onImport,
  onDelete,
}: {
  character: GameCharacter;
  onImport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-5 overflow-hidden px-7 py-6">
      <DetailHead character={character} onImport={onImport} onDelete={onDelete} />
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Derived derived={character.derived} />
        <div className="flex min-h-0 flex-1 gap-4">
          <AttrsCard character={character} />
          <SkillsCard character={character} />
        </div>
      </div>
    </div>
  );
}

function DetailHead({
  character,
  onImport,
  onDelete,
}: {
  character: GameCharacter;
  onImport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-4.5">
      <div className="bg-surface-tertiary border-separator-secondary h-[132px] w-[104px] shrink-0 overflow-hidden rounded-[14px] border">
        {character.portrait ? (
          <img src={character.portrait} alt={character.name} className="size-full object-cover" />
        ) : (
          <div className="text-foreground-tertiary flex size-full items-center justify-center">
            <UserRound className="size-9" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-foreground font-serif text-[22px] font-bold">{character.name}</h2>
          <KindBadge kind={character.kind} />
          {character.claim && (
            <Badge tone="success" variant="soft" size="sm" className="font-sans">
              {character.claim}
            </Badge>
          )}
        </div>
        <p className="text-foreground-secondary font-sans text-[13px]">{character.meta}</p>

        <div className="flex items-center gap-2">
          <span className="text-foreground-tertiary font-sans text-[11px]">立绘</span>
          {character.expressions.map((label, index) => {
            const active = index === 0;
            return (
              <div
                key={label}
                className={cn(
                  "bg-surface-tertiary flex size-10 items-center justify-center rounded-[9px] border font-sans text-[10px]",
                  active
                    ? "border-accent-hover text-accent-hover border-[1.5px]"
                    : "border-separator-secondary text-foreground-tertiary",
                )}
              >
                {label}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="icon-md"
            className="border-separator-tertiary text-foreground-tertiary hover:text-foreground flex size-10 items-center justify-center rounded-[9px] border-[1.5px] transition-colors"
            aria-label="新增立绘"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" className="h-[34px]" onClick={onImport}>
          <FileSpreadsheet />
          重导 Excel
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-foreground-secondary size-[34px]" aria-label="编辑">
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-danger-soft-foreground size-[34px]"
          aria-label="删除"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

const DERIVED_CONFIG: { key: keyof DerivedStats; label: string; icon: LucideIcon; iconColor: string }[] = [
  { key: "hp", label: "HP", icon: HeartPulse, iconColor: "text-brand-wakatake" },
  { key: "mp", label: "MP", icon: Sparkles, iconColor: "text-brand-sora" },
  { key: "san", label: "SAN", icon: Brain, iconColor: "text-brand-yamabuki" },
  { key: "luck", label: "幸运", icon: Clover, iconColor: "text-brand-fuji" },
  { key: "mov", label: "MOV", icon: Footprints, iconColor: "text-foreground-secondary" },
];

function formatDerived(derived: DerivedStats, key: keyof DerivedStats): string {
  const value = derived[key];
  if (typeof value === "number") return String(value);
  return `${value.current} / ${value.max}`;
}

function Derived({ derived }: { derived: DerivedStats }) {
  return (
    <div className="flex shrink-0 gap-3">
      {DERIVED_CONFIG.map(({ key, label, icon: Icon, iconColor }) => (
        <Card
          key={key}
          className="border-separator flex flex-1 gap-1.5 rounded-xl border p-3.5"
        >
          <div className="flex items-center gap-1.5">
            <Icon className={cn("size-[13px]", iconColor)} />
            <span className="text-foreground-secondary font-sans text-[11px] font-semibold tracking-[0.5px]">
              {label}
            </span>
          </div>
          <span className="text-foreground font-mono text-lg font-bold">{formatDerived(derived, key)}</span>
        </Card>
      ))}
    </div>
  );
}

function AttrsCard({ character }: { character: GameCharacter }) {
  const rows = chunk(character.attributes, 3);
  return (
    <Card className="border-separator w-[420px] shrink-0 gap-3 rounded-[14px] border p-4">
      <h3 className="text-foreground-secondary font-sans text-xs font-semibold tracking-[1px]">基础属性</h3>
      <div className="flex flex-col gap-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
            {row.map((attr) => (
              <div
                key={attr.abbr}
                className="bg-surface-tertiary flex flex-1 flex-col gap-0.5 rounded-[10px] p-2.5"
              >
                <span className="text-foreground-tertiary font-sans text-[10px]">
                  {attr.label} {attr.abbr}
                </span>
                <div className="flex items-end gap-[5px]">
                  <span className="text-foreground font-mono text-xl font-bold leading-none">{attr.value}</span>
                  <span className="text-foreground-tertiary font-mono text-[10px]">
                    ／{Math.floor(attr.value / 2)} · {Math.floor(attr.value / 5)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function SkillsCard({ character }: { character: GameCharacter }) {
  const rows = chunk(character.skills, 3);
  return (
    <Card className="border-separator min-h-0 flex-1 gap-3 overflow-hidden rounded-[14px] border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground-secondary font-sans text-xs font-semibold tracking-[1px]">技能</h3>
        <span className="text-foreground-tertiary font-sans text-[11px]">高于初始值已标记</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1.5">
            {row.map((skill) => (
              <div
                key={skill.label}
                className={cn(
                  "flex flex-1 items-center justify-between rounded-lg px-2.5 py-2",
                  skill.highlighted ? "bg-accent-soft" : "bg-surface-tertiary",
                )}
              >
                <span
                  className={cn(
                    "font-sans text-xs",
                    skill.highlighted ? "text-accent-soft-foreground" : "text-foreground-secondary",
                  )}
                >
                  {skill.label}
                </span>
                <span
                  className={cn(
                    "font-mono text-[13px]",
                    skill.highlighted ? "text-accent-soft-foreground font-bold" : "text-foreground font-medium",
                  )}
                >
                  {skill.value}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
