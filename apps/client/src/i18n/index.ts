import { useSyncExternalStore } from "react";
import { zhCN } from "./messages/zh-CN";

const BASE_LOCALE = "zh-CN";

export type MessageOverrides = Record<string, Record<string, string>> | undefined;

let activeLocale = BASE_LOCALE;
let activeOverrides: MessageOverrides = undefined;
let messageVersion = 0;
const messageListeners = new Set<() => void>();

function notifyMessages(): void {
  messageVersion += 1;
  for (const listener of messageListeners) {
    listener();
  }
}

export function setMessageRuntime(locale: string, overrides: MessageOverrides): void {
  activeLocale = locale;
  activeOverrides = overrides;
  notifyMessages();
}

export function resetMessageRuntime(): void {
  activeLocale = BASE_LOCALE;
  activeOverrides = undefined;
  notifyMessages();
}

function subscribeMessages(listener: () => void): () => void {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

function getMessageVersion(): number {
  return messageVersion;
}

export function useI18nVersion(): number {
  return useSyncExternalStore(subscribeMessages, getMessageVersion, getMessageVersion);
}

export function getActiveLocale(): string {
  return activeLocale;
}

function lookup(messages: Record<string, string> | undefined, key: string): string | undefined {
  if (!messages || !Object.hasOwn(messages, key)) {
    return undefined;
  }
  return messages[key];
}

function resolveTemplate(key: string): string | undefined {
  const overrides = activeOverrides;
  const localeMessages =
    overrides && Object.hasOwn(overrides, activeLocale) ? overrides[activeLocale] : undefined;
  const defaultMessages =
    overrides && Object.hasOwn(overrides, BASE_LOCALE) ? overrides[BASE_LOCALE] : undefined;
  return lookup(localeMessages, key) ?? lookup(defaultMessages, key) ?? lookup(zhCN, key);
}

export function translateOr(
  key: string,
  fallback: string,
  vars?: Record<string, string | number>,
): string {
  const template = resolveTemplate(key) ?? fallback;
  if (!vars) {
    return template;
  }
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(key: string, vars?: Record<string, string | number>): string {
  return translateOr(key, key, vars);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  return translate(key, vars);
}