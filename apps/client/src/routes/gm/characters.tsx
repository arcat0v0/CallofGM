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
import { api, fetchAllPages, mediaUrl } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { t, useI18nVersion } from "@/i18n";
import { EXPRESSION_KEYS, expressionLabel } from "@/lib/format";
import { requireGmAuth } from "@/lib/identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gm/characters")({
  beforeLoad: requireGmAuth,
  component: GmCharactersPage,
});

type Filter = "all" | "PC" | "NPC";

function GmCharactersPage() {
  useI18nVersion();
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
      toast.error(errorText(error, "gm.characters.loadFailed"));
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
      <div className="-mx-10 -my-9 flex h-screen overflow-hidden">
        <aside className="bg-background flex w-80 flex-col">
          <div className="flex flex-col gap-3 px-4 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-headline-small-emph">{t("gm.characters.title")}</h1>
              <div className="flex gap-1.5">
                <Button type="button" onClick={() => setCreateOpen(true)} variant="primary" size="sm" className="h-[30px] px-3">
                  <Plus /> {t("gm.characters.create")}
                </Button>
                <Button type="button" onClick={() => setImportOpen(true)} variant="outline" size="sm" className="h-[30px] px-3">
                  {t("gm.characters.import")}
                </Button>
              </div>
            </div>
            <InputGroup className="h-9">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("gm.characters.searchPlaceholder")} aria-label={t("gm.characters.searchPlaceholder")} />
            </InputGroup>
            <SegmentedControl
              value={filter}
              options={([
                ["all", t("gm.characters.filterAll", { count: counts.all })],
                ["PC", t("gm.characters.filterPc", { count: counts.PC })],
                ["NPC", t("gm.characters.filterNpc", { count: counts.NPC })],
              ] as const).map(([value, label]) => ({ value, label }))}
              onValueChange={setFilter}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-2.5">
            {visible.map((character, index) => (
              <Button
                key={character.id}
                type="button"
                variant="ghost"
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-4 mb-1 h-auto w-full justify-start gap-2.5 px-2.5 py-2 duration-500 ease-standard-default-spatial",
                  index % 3 === 1 ? "delay-75" : index % 3 === 2 ? "delay-150" : "",
                  selected?.id === character.id && "bg-md-secondary-container text-md-on-secondary-container",
                )}
                onClick={() => setSelectedId(character.id)}
              >
                <Avatar size="sm"><AvatarFallback>{character.initial}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1 truncate text-left text-label-large-emph">{character.name}</span>
                <Badge variant="soft" size="sm">{character.kind}</Badge>
              </Button>
            ))}
          </div>
        </aside>
        {selected ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-1 flex-col gap-4 overflow-auto px-7 py-6 duration-500 ease-standard-default-spatial">
            <div className="flex gap-4">
              <div className="bg-surface-tertiary size-[132px] overflow-hidden rounded-t-full rounded-b-xl">
                {selected.portrait ? <img src={selected.portrait} alt={selected.name} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center"><UserRound /></div>}
              </div>
              <div className="flex-1">
                <h2 className="font-serif text-headline-small-emph">{selected.name}</h2>
                <p className="text-foreground-secondary text-body-medium">{selected.meta}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>{t("gm.characters.importExcel")}</Button>
                  <Select value={portraitKey} onValueChange={setPortraitKey}>
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPRESSION_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>{expressionLabel(key)}</SelectItem>
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
                            toast.error(errorText(error, "gm.characters.uploadFailed"));
                          }
                        })();
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span><Upload /> {t("gm.characters.uploadPortrait")}</span>
                    </Button>
                  </label>
                  <Button variant="dangerSoft" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 /> {t("common.delete")}</Button>
                </div>
                {selected.portraits.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.portraits.map((portrait) => (
                      <div key={portrait.id ?? portrait.expressionKey} className="flex flex-col items-center gap-1">
                        <div className="bg-surface-tertiary size-16 overflow-hidden rounded-xl">
                          <img src={mediaUrl(portrait.portraitAssetId) ?? undefined} alt={expressionLabel(portrait.expressionKey)} className="size-full object-cover" />
                        </div>
                        <span className="text-foreground-tertiary text-label-small">{expressionLabel(portrait.expressionKey)}</span>
                        {portrait.id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-label-small"
                            onClick={() => {
                              const portraitId = portrait.id;
                              if (!portraitId) return;
                              void api(`/gm/characters/portraits/${encodeURIComponent(portraitId)}`, { method: "DELETE" })
                                .then(() => reload())
                                .catch((error) => toast.error(errorText(error, "gm.characters.deletePortraitFailed")));
                            }}
                          >
                            {t("common.delete")}
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
                <Card key={key} className="rounded-2xl p-3 text-center">
                  <div className="text-foreground-tertiary text-label-small uppercase">{key}</div>
                  <div className="text-body-large-emph">{selected.derived[key].current}/{selected.derived[key].max}</div>
                </Card>
              ))}
              <Card className="rounded-2xl p-3 text-center"><div className="text-label-small">LUCK</div><div className="text-body-large-emph">{selected.derived.luck}</div></Card>
              <Card className="rounded-2xl p-3 text-center"><div className="text-label-small">MOV</div><div className="text-body-large-emph">{selected.derived.mov}</div></Card>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="rounded-2xl p-4">
                {selected.attributes.map((attr) => (
                  <div key={attr.abbr} className="flex justify-between text-body-medium"><span>{attr.label}</span><span>{attr.value}</span></div>
                ))}
              </Card>
              <Card className="rounded-2xl p-4">
                {selected.skills.map((skill) => (
                  <div key={skill.label} className="flex justify-between text-body-medium"><span>{skill.label}</span><span>{skill.value}</span></div>
                ))}
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-foreground-tertiary flex flex-1 items-center justify-center">{t("gm.characters.empty")}</div>
        )}
      </div>
      <CreateCharacterDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void reload()} />
      <ImportCharacterSheetDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void reload()} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        icon={Trash2}
        confirmIcon={Trash2}
        title={t("gm.characters.deleteTitle")}
        description={t("gm.characters.deleteDescription", { name: selected?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={() => {
          const id = selected?.id;
          setDeleteOpen(false);
          if (!id) return;
          void api(`/gm/characters/${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => reload()).catch((error) => toast.error(errorText(error, "gm.characters.deleteFailed")));
        }}
      />
    </AdminLayout>
  );
}
