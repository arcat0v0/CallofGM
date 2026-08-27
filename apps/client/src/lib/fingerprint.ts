import { load } from "@fingerprintjs/fingerprintjs";

let known: string | null = null;
let pending: Promise<string> | null = null;

export function getKnownFingerprint(): string | null {
  return known;
}

export function getFingerprint(): Promise<string> {
  if (known) {
    return Promise.resolve(known);
  }
  if (!pending) {
    pending = load()
      .then((agent) => agent.get())
      .then((result) => {
        known = result.visitorId;
        return known;
      });
  }
  return pending;
}
