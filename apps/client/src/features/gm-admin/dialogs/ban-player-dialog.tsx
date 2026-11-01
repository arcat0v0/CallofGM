import { Info, ShieldBan, X } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";

const durations = ["1h", "24h", "7d", "30d", "forever", "custom"] as const;

type BanDuration = (typeof durations)[number];

const durationSeconds: Record<BanDuration, number | undefined> = {
  "1h": 3600,
  "24h": 86400,
  "7d": 7 * 86400,
  "30d": 30 * 86400,
  forever: undefined,
  custom: undefined,
};

const durationLabelKeys: Record<BanDuration, string> = {
  "1h": "gm.ban.duration1h",
  "24h": "gm.ban.duration24h",
  "7d": "gm.ban.duration7d",
  "30d": "gm.ban.duration30d",
  forever: "gm.ban.durationPermanent",
  custom: "gm.ban.durationCustom",
};

function BanPlayerDialog({
  open,
  onOpenChange,
  playerName = t("gm.ban.anonymous"),
  roleLabel = t("gm.ban.playerFallback"),
  fingerprint = "",
  defaultPlayerId = "",
  onBan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName?: string;
  roleLabel?: string;
  fingerprint?: string;
  defaultPlayerId?: string;
  onBan?: (input: { playerId: string; reason: string; durationSeconds?: number }) => void | Promise<void>;
}) {
  const [duration, setDuration] = useState<BanDuration>("7d");
  const [playerId, setPlayerId] = useState(defaultPlayerId);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function handleBan() {
    const trimmed = playerId.trim();
    if (!trimmed || pending) {
      return;
    }
    setPending(true);
    try {
      await onBan?.({
        playerId: trimmed,
        reason,
        durationSeconds: durationSeconds[duration],
      });
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-130 gap-0 p-0" showCloseButton={false}>
        <DialogHeader className="flex-row items-start justify-between gap-3 px-5 py-[18px]">
          <div className="flex items-start gap-3">
            <span className="bg-danger-soft flex size-9 shrink-0 items-center justify-center rounded-md">
              <ShieldBan className="text-danger-soft-foreground size-[18px]" />
            </span>
            <div className="flex flex-col gap-0.5">
              <DialogTitle>{t("gm.ban.title")}</DialogTitle>
              <DialogDescription>{t("gm.ban.description")}</DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={t("gm.ban.close")} onClick={() => onOpenChange(false)}>
            <X />
          </Button>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="bg-surface-tertiary flex items-center gap-3 rounded-xl px-3 py-3">
            <Avatar size="md" className="bg-default">
              <AvatarFallback className="text-foreground-secondary">?</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-foreground font-sans text-label-large-emph">{playerName}</span>
                <Badge variant="soft" tone="default" size="sm">
                  {roleLabel}
                </Badge>
              </div>
              <span className="text-foreground-tertiary font-mono text-label-small">{fingerprint || t("gm.ban.inputHint")}</span>
            </div>
          </div>

          <FormField label={t("gm.ban.playerId")} htmlFor="ban-player-id">
            <Input
              id="ban-player-id"
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
              placeholder="playerId"
              className="border-separator-secondary font-mono text-label-large"
            />
          </FormField>

          <FormField label={t("gm.ban.duration")}>
            <RadioGroup value={duration} onValueChange={(value) => setDuration(value as BanDuration)} className="grid-cols-3">
              {durations.map((option) => {
                const selected = option === duration;
                return (
                  <Label
                    key={option}
                    className={selected
                      ? "bg-danger-soft text-danger-soft-foreground h-[38px] cursor-pointer justify-center rounded-md text-label-large-emph"
                      : "bg-surface-tertiary text-foreground-secondary h-[38px] cursor-pointer justify-center rounded-md text-label-large"
                    }
                  >
                    <RadioGroupItem value={option} className="data-checked:border-danger-soft-foreground data-checked:bg-danger-soft-foreground" />
                    {t(durationLabelKeys[option])}
                  </Label>
                );
              })}
            </RadioGroup>
          </FormField>

          <FormField label={t("gm.ban.reason")} htmlFor="ban-note">
            <Textarea
              id="ban-note"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("gm.ban.reasonPlaceholder")}
              className="h-16 min-h-16 resize-none border-separator-secondary text-body-medium"
            />
          </FormField>

          <Alert className="bg-surface-tertiary gap-2.5 rounded-md px-3 py-3 shadow-none">
            <AlertIcon className="mt-0.5 text-foreground-tertiary">
              <Info />
            </AlertIcon>
            <AlertDescription className="text-foreground-secondary text-body-small">
              {t("gm.ban.note")}
            </AlertDescription>
          </Alert>
        </div>

        <div className="bg-md-surface-container-low flex items-center justify-end gap-2.5 rounded-b-xl px-5 py-4">
          <Button variant="tertiary" size="sm" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" size="sm" disabled={!playerId.trim() || pending} onClick={() => void handleBan()}>
            <ShieldBan className="size-[15px]" />
            {t("gm.ban.confirm", { duration: t(durationLabelKeys[duration]) })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { BanPlayerDialog };
