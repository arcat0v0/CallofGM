import { useState } from "react";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Send } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { HandoutPreview, HandoutScopeBadge } from "@/features/session-live/handout-preview";
import { initialsOf } from "@/lib/format";
import { sendSessionCommand } from "@/lib/session-socket";
import { usePlayStore } from "@/stores/play-store";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { GmPanelShell, GmSelectField } from "./gm-panel-fields";

type Scope = "public" | "secret";

function HandoutPanel({ onClose }: { onClose: () => void }) {
  const handouts = usePlayStore((state) => state.catalogHandouts);
  const grants = usePlayStore((state) => state.handouts);
  const characters = usePlayStore((state) => state.characters).filter((character) => character.kind === "pc");
  const moduleId = usePlayStore((state) => state.moduleId);
  const [handoutId, setHandoutId] = useState("");
  const [scope, setScope] = useState<Scope>("secret");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const selected = handouts.find((handout) => handout.id === handoutId) ?? handouts[0] ?? null;
  const selectedGrants = selected ? grants.filter((grant) => grant.handout.id === selected.id) : [];
  const publicGranted = selectedGrants.some((grant) => grant.isPublic);
  const secretGranted = selectedGrants.some((grant) => !grant.isPublic);
  const recipients = characters.filter((character) => recipientIds.includes(character.characterId));
  const recipientLabel = recipients.map((character) => character.name).join(t("common.listSeparator"));
  const groupedGrants = [...grants
    .reduce((map, item) => {
      const current = map.get(item.handout.id);
      if (current) {
        current.items.push(item);
        current.isPublic = current.isPublic || item.isPublic;
      } else {
        map.set(item.handout.id, { handout: item.handout, items: [item], isPublic: item.isPublic });
      }
      return map;
    }, new Map<string, { handout: (typeof grants)[number]["handout"]; items: Array<(typeof grants)[number]>; isPublic: boolean }>())
    .values()];
  const grantDisabled = publicGranted || (scope === "secret" && recipientIds.length === 0);

  function toggleRecipient(characterId: string) {
    setRecipientIds((current) =>
      current.includes(characterId)
        ? current.filter((id) => id !== characterId)
        : [...current, characterId],
    );
  }

  function grant() {
    if (!selected) {
      return;
    }
    if (scope === "secret" && recipientIds.length === 0) {
      toast.error(t("gm.console.noRecipient"));
      return;
    }
    sendSessionCommand("handout:grant", {
      handoutId: selected.id,
      recipientCharacterIds: scope === "public" ? [] : recipientIds,
    });
  }

  function append(grantId: string) {
    if (recipientIds.length === 0) {
      toast.error(t("gm.console.noRecipient"));
      return;
    }
    sendSessionCommand("handout:append", { grantId, recipientCharacterIds: recipientIds });
  }

  return (
    <GmPanelShell
        title={t("gm.workbench.handoutTitle")}
        subtitle={t("gm.workbench.handoutSubtitle")}
        onClose={onClose}
        footer={
          selected ? (
            <div className={cn("flex items-center gap-3", publicGranted ? "justify-end" : "justify-between")}>
              {publicGranted ? null : (
                <span
                  data-secret-recipients={recipientIds.join(",")}
                  className="text-md-on-surface-variant flex min-w-0 items-center gap-2 text-label-medium"
                >
                  <EyeOff className="size-4 shrink-0" />
                  <span className="truncate">
                    {scope === "secret" && recipientIds.length === 0
                      ? t("gm.console.noRecipients")
                      : scope === "secret" && recipientLabel
                        ? t("gm.console.secretRecipients", { names: recipientLabel })
                        : t("gm.workbench.secretHint")}
                  </span>
                </span>
              )}
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="h-12 shrink-0 px-4"
                disabled={grantDisabled}
                onClick={grant}
              >
                <Send className="size-4" />
                {publicGranted
                  ? t("gm.workbench.publicGranted")
                  : scope === "public"
                    ? t("gm.workbench.grantPublic")
                    : t("gm.workbench.grantSecretCount", { count: recipientIds.length })}
              </Button>
            </div>
          ) : undefined
        }
      >
      {!selected ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-md-on-surface-variant text-body-medium">{t("gm.console.noHandouts")}</p>
          {moduleId ? (
            <Button asChild variant="tertiary" size="sm" className="h-10 bg-md-surface-container-highest">
              <Link to="/gm/module/$moduleId" params={{ moduleId }}>
                {t("gm.workbench.manageHandouts")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <GmSelectField
            label={t("gm.workbench.handoutItem")}
            value={selected.id}
            onValueChange={setHandoutId}
          >
            {handouts.map((handout) => (
              <SelectItem key={handout.id} value={handout.id}>
                {handout.title}
              </SelectItem>
            ))}
          </GmSelectField>

          <HandoutPreview
            title={selected.title}
            content={selected.content}
            imageAssetId={selected.imageAssetId}
            imageAlt={selected.title}
          />

          <GmSelectField
            label={t("gm.workbench.handoutScope")}
            value={publicGranted ? "public" : scope}
            disabled={publicGranted}
            onValueChange={(value) => setScope(value as Scope)}
          >
            <SelectItem value="public">{t("gm.workbench.scopePublic")}</SelectItem>
            <SelectItem value="secret">{t("gm.workbench.scopeSecret")}</SelectItem>
          </GmSelectField>

          {publicGranted ? (
            <div className="bg-md-primary-container/40 border-md-primary/25 flex items-center gap-3 rounded-lg border p-4">
              <Eye className="text-md-primary size-5 shrink-0" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-md-on-primary-container text-title-small-emph">{t("gm.workbench.scopePublic")}</span>
                <span className="text-md-on-primary-container/85 text-label-small">
                  {t("gm.workbench.publicGrantedHint")}
                </span>
              </div>
            </div>
          ) : scope === "secret" ? (
            <div className="flex flex-col gap-2">
              <span className="text-md-on-surface-variant text-label-medium">{t("gm.workbench.recipients")}</span>
              {characters.length === 0 ? (
                <p className="text-md-on-surface-variant text-label-small">{t("gm.console.noPcHandout")}</p>
              ) : (
                characters.map((character) => {
                  const checked = recipientIds.includes(character.characterId);
                  return (
                    <button
                      key={character.characterId}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleRecipient(character.characterId)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left outline-none transition-colors duration-150 ease-standard-fast-effects focus-visible:ring-4 focus-visible:ring-focus-ring/50",
                        checked
                          ? "bg-md-primary-container border-md-primary/25 text-md-on-primary-container"
                          : "bg-md-surface-container text-md-on-surface hover:bg-md-surface-container-high border-md-outline-variant/50",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full text-label-medium-emph",
                          checked
                            ? "bg-md-primary-container border-md-primary/25 text-md-on-primary-container border"
                            : "bg-md-surface-container-high text-md-on-surface-variant",
                        )}
                      >
                        {initialsOf(character.name)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-label-large">{character.name}</span>
                        <span className={cn("truncate text-label-small", checked ? "text-md-on-primary-container" : "text-md-on-surface-variant")}>
                          {t("common.pc")}
                          {secretGranted ? ` · ${t("gm.workbench.handoutSecretSent")}` : ""}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-xs border-2",
                          checked
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-md-on-surface-variant",
                        )}
                      >
                        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : null}

          {groupedGrants.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-separator-secondary pt-4">
              <span className="text-md-on-surface-variant text-label-medium-emph">{t("gm.console.granted")}</span>
              <div className="flex flex-col gap-1.5">
                {groupedGrants.map((group) => {
                  const secretGrant = group.items.find((item) => !item.isPublic);
                  return (
                    <div key={group.handout.id} className="bg-md-surface-container border border-md-outline-variant/50 flex items-center gap-2 rounded-lg px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-label-medium">{group.handout.title}</span>
                      <HandoutScopeBadge isPublic={group.isPublic} />
                      {secretGrant ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-7 px-2 text-label-small"
                          disabled={recipientIds.length === 0}
                          onClick={() => append(secretGrant.grantId)}
                        >
                          {t("gm.console.append")}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </GmPanelShell>
  );
}

export { HandoutPanel };