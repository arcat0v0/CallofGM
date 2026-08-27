import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Trash2, Upload, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminLayout } from "@/features/gm-admin/admin-layout";
import { mapCharacterRow, type CharacterRow, type GameCharacter } from "@/lib/character-sheet";
import { CreateCharacterDialog } from "@/features/gm-admin/dialogs/create-character-dialog";
import { ImportCharacterSheetDialog } from "@/features/gm-admin/dialogs/import-character-sheet-dialog";
import { api, fetchAllPages, isApiError, mediaUrl } from "@/lib/api";
import { EXPRESSION_LABELS, expressionLabel } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/characters")({
  beforeLoad: requireGmAuth,
  component: GmCharactersPage,
});

type Filter = "all" | "PC" | "NPC";

function GmCharactersPage() {
  const [list, setList] = useState<GameCharacter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [portraitKey, setPortraitKey] = useState("default");

  async function reload() {
    try {
      const mapped = (await fetchAllPages<CharacterRow>("/gm/characters")).map(mapCharacterRow);
      setList(mapped);
      setSelectedId((current) => (current && mapped.some((item) => item.id === current) ? current : mapped[0]?.id ?? null));
    } catch (error) {
      toast.error(isApiError(error) ? error.message : "无法加载人物");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    let cancelled = false;
    void api<CharacterRow>(`/gm/characters/${encodeURIComponent(selectedId)}`)
      .then((row) => {
        if (cancelled) {
          return;
        }
        const mapped = mapCharacterRow(row);
        setList((current) => current.map((item) => (item.id === mapped.id ? mapped : item)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const visible = useMemo(() => {
    const q = query.trim();
    return list.filter((character) => (filter === "all" || character.kind === filter) && (!q || character.name.includes(q)));
  }, [filter, list, query]);
  const selected = list.find((character) => character.id === selectedId) ?? list[0];
  const counts = { all: list.length, PC: list.filter((c) => c.kind === "PC").length, NPC: list.filter((c) => c.kind === "NPC").length };

  return (
    <AdminLayout active="characters">
      <div className="-mx-8 -my-7 flex h-screen overflow-hidden">
        <aside className="bg-background-secondary border-separator flex w-80 flex-col border-r">
          <div className="flex flex-col gap-3 px-4 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-lg font-bold">人物</h1>
              <div className="flex gap-1.5">
                <Button type="button" onClick={() => setCreateOpen(true)} variant="primaryGradient" size="sm" className="h-[30px] px-3 text-xs">
                  <Plus /> 新建
                </Button>
                <Button type="button" onClick={() => setImportOpen(true)} variant="outline" size="sm" className="h-[30px] px-3 text-xs">
                  导入
                </Button>
              </div>
            </div>
            <InputGroup className="h-9">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索人物…" aria-label="搜索人物" />
            </InputGroup>
            <SegmentedControl
              value={filter}
              options={([
                ["all", `全部 ${counts.all}`],
                ["PC", `PC ${counts.PC}`],
                ["NPC", `NPC ${counts.NPC}`],
              ] as const).map(([value, label]) => ({ value, label }))}
              onValueChange={setFilter}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-2.5">
            {visible.map((character) => (
              <Button key={character.id} type="button" variant="ghost" className={cn("mb-1 h-auto w-full justify-start gap-2.5 px-2.5 py-2", selected?.id === character.id && "bg-default")} onClick={() => setSelectedId(character.id)}>
                <Avatar size="sm"><AvatarFallback>{character.initial}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">{character.name}</span>
                <Badge variant="soft" size="sm">{character.kind}</Badge>
              </Button>
            ))}
          </div>
        </aside>
        {selected ? (
          <div className="flex flex-1 flex-col gap-4 overflow-auto px-7 py-6">
            <div className="flex gap-4">
              <div className="bg-surface-tertiary size-[132px] overflow-hidden rounded-[14px]">
                {selected.portrait ? <img src={selected.portrait} alt={selected.name} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center"><UserRound /></div>}
              </div>
              <div className="flex-1">
                <h2 className="font-serif text-[22px] font-bold">{selected.name}</h2>
                <p className="text-foreground-secondary text-sm">{selected.meta}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>导入 Excel</Button>
                  <Select value={portraitKey} onValueChange={setPortraitKey}>
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXPRESSION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        const id = selected.id;
                        if (!file || !id) return;
                        void (async () => {
                          try {
                            const body = new FormData();
                            body.append("file", file);
                            body.append("purpose", "portrait");
                            body.append("filename", file.name);
                            const asset = await api<{ id: string }>("/media/upload", { method: "POST", body });
                            await api(`/gm/characters/${encodeURIComponent(id)}/portraits`, {
                              method: "POST",
                              body: JSON.stringify({
                                expressionKey: portraitKey || "default",
                                portraitAssetId: asset.id,
                                isDefault: portraitKey === "default",
                              }),
                            });
                            await reload();
                          } catch (error) {
                            toast.error(isApiError(error) ? error.message : "立绘上传失败");
                          }
                        })();
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span><Upload /> 立绘</span>
                    </Button>
                  </label>
                  <Button variant="dangerSoft" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 /> 删除</Button>
                </div>
                {selected.portraits.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.portraits.map((portrait) => (
                      <div key={portrait.id ?? portrait.expressionKey} className="flex flex-col items-center gap-1">
                        <div className="bg-surface-tertiary size-16 overflow-hidden rounded-lg">
                          <img src={mediaUrl(portrait.portraitAssetId)} alt={expressionLabel(portrait.expressionKey)} className="size-full object-cover" />
                        </div>
                        <span className="text-foreground-tertiary text-[10px]">{expressionLabel(portrait.expressionKey)}</span>
                        {portrait.id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={() => {
                              const portraitId = portrait.id;
                              if (!portraitId) return;
                              void api(`/gm/characters/portraits/${encodeURIComponent(portraitId)}`, { method: "DELETE" })
                                .then(() => reload())
                                .catch((error) => toast.error(isApiError(error) ? error.message : "删除立绘失败"));
                            }}
                          >
                            删除
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(["hp", "mp", "san"] as const).map((key) => (
                <Card key={key} className="p-3 text-center">
                  <div className="text-foreground-tertiary text-[11px] uppercase">{key}</div>
                  <div className="font-semibold">{selected.derived[key].current}/{selected.derived[key].max}</div>
                </Card>
              ))}
              <Card className="p-3 text-center"><div className="text-[11px]">LUCK</div><div className="font-semibold">{selected.derived.luck}</div></Card>
              <Card className="p-3 text-center"><div className="text-[11px]">MOV</div><div className="font-semibold">{selected.derived.mov}</div></Card>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                {selected.attributes.map((attr) => (
                  <div key={attr.abbr} className="flex justify-between text-sm"><span>{attr.label}</span><span>{attr.value}</span></div>
                ))}
              </Card>
              <Card className="p-4">
                {selected.skills.map((skill) => (
                  <div key={skill.label} className="flex justify-between text-sm"><span>{skill.label}</span><span>{skill.value}</span></div>
                ))}
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-foreground-tertiary flex flex-1 items-center justify-center">暂无人物</div>
        )}
      </div>
      <CreateCharacterDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void reload()} />
      <ImportCharacterSheetDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void reload()} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        icon={Trash2}
        confirmIcon={Trash2}
        title="删除人物"
        description={`确定要删除「${selected?.name ?? ""}」吗？`}
        confirmLabel="删除"
        onConfirm={() => {
          const id = selected?.id;
          setDeleteOpen(false);
          if (!id) return;
          void api(`/gm/characters/${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => reload()).catch((error) => toast.error(isApiError(error) ? error.message : "删除失败"));
        }}
      />
    </AdminLayout>
  );
}
