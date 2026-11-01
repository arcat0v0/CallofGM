import { Info, ShieldBan, X } from "lucide-react";
import { useEffect, useState } from "react";
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

const DURATIONS = [
  { key: "gm.ban.duration1h", seconds: 3600 },
  { key: "gm.ban.duration24h", seconds: 86_400 },
  { key: "gm.ban.duration7d", seconds: 7 * 86_400 },
  { key: "gm.ban.duration30d", seconds: 30 * 86_400 },
  { key: "{{SECRET_ixphk3bf}}", seconds: undefined },
  { key: "{{SECRET_9t43oiwb}}", seconds: undefined },
] as const;

type DurationKey = (typeof DURATIONS)[number]["key"];

function durationSecondsOf(key: DurationKey): number | undefined {
  return DURATIONS.find((item) => item.key === key)?.seconds;
}

function shortHash(hash: string): string {
  return hash.length <= 16 ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function BanPlayerDialog({
  open,
  onOpenChange,
  playerName = t("gm.ban.anonymous"),
  roleLabel = t("common.player"),
  fingerprint = "",
  defaultPlayerId = "",
  defaultFingerprintHash = "",
  onBan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName?: string;
  roleLabel?: string;
  fingerprint?: string;
  defaultPlayerId?: string;
  defaultFingerprintHash?: string;
  onBan?: (input: {
    playerId?: string;
    fingerprintHash?: string;
    reason: string;
    durationSeconds?: number;
  }) => void | Promise<void>;
}) {
  const [duration, setDuration] = useState<DurationKey>("gm.ban.duration7d");
  const [playerId, setPlayerId] = useState(defaultPlayerId);
  const [fingerprintHash, setFingerprintHash] = useState(defaultFingerprintHash);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPlayerId(defaultPlayerId);
    setFingerprintHash(defaultFingerprintHash);
    setReason("");
    setDuration("gm.ban.duration7d");
  }, [open, defaultPlayerId, defaultFingerprintHash]);

  const hashOnly = defaultFingerprintHash.trim().length > 0;
  const ready = (playerId.trim() || fingerprintHash.trim()).length > 0;

  async function handleBan() {
    const trimmedPlayerId = playerId.trim();
    const trimmedHash = fingerprintHash.trim();
    if (!ready || pending) {
      return;
    }
    setPending(true);
    try {
      await onBan?.({
        ...(trimmedPlayerId
          ? { playerId: trimmedPlayerId, fingerprintHash: undefined }
          : { fingerprintHash: trimmedHash, playerId: undefined }),
        reason,
        durationSeconds: durationSecondsOf(duration),
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
              <span className="text-foreground-tertiary font-mono text-label-small">
                {fingerprint || (hashOnly ? shortHash(defaultFingerprintHash) : t("gm.ban.inputHint"))}
              </span>
            </div>
          </div>

          {hashOnly ? (
            <FormField label={t("gm.ban.fingerprintHash")} htmlFor="ban-fingerprint-hash">
              <Input
                id="ban-fingerprint-hash"
                value={fingerprintHash}
                readOnly
                className="border-separator-secondary font-mono text-label-large"
              />
            </FormField>
          ) : (
            <FormField label={t("gm.ban.playerId")} htmlFor="ban-player-id">
              <Input
                id="ban-player-id"
                value={playerId}
                onChange={(event) => setPlayerId(event.target.value)}
                placeholder="playerId"
                className="border-separator-secondary font-mono text-label-large"
              />
            </FormField>
          )}

          <FormField label={t("gm.ban.duration")}>
            <RadioGroup value={duration} onValueChange={(value) => setDuration(value as DurationKey)} className="grid-cols-3">
              {DURATIONS.map((option) => {
                const selected = option.key === duration;
                return (
                  <Label
                    key={option.key}
                    className={selected
                      ? "bg-danger-soft text-danger-soft-foreground h-[38px] cursor-pointer justify-center rounded-md text-label-large-emph"
                      : "bg-surface-tertiary text-foreground-secondary h-[38px] cursor-pointer justify-center rounded-md text-label-large"
                    }
                  >
                    <RadioGroupItem value={option.key} className="data-checked:border-danger-soft-foreground data-checked:bg-danger-soft-foreground" />
                    {t(option.key)}
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
          <Button variant="danger" size="sm" disabled={!ready || pending} onClick={() => void handleBan()}>
            <ShieldBan className="size-[15px]" />
            {t("gm.ban.confirm", { duration: t(duration) })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { BanPlayerDialog };
