import { t, translateOr } from "@/i18n";
import { isApiError } from "./api";

export function errorText(error: unknown, fallbackKey: string): string {
  if (isApiError(error)) {
    return translateOr(`error.${error.code}`, error.message);
  }
  return t(fallbackKey);
}