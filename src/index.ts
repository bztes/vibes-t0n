/// <reference path="./virtual.d.ts" />
import reactivity from 'virtual:t0n-reactivity';
import { fallbackLocale, isLocale, localeCookie, negotiateLocale, type Locale } from './config.js';
import { placeholderPattern } from './format.js';

export {
	locales,
	localeNames,
	localeCookie,
	fallbackLocale,
	isLocale,
	type Locale
} from './config.js';

/** Translations of one source file, emitted by the t0n vite plugin. */
export interface FileMessages {
	/** translations per locale, with missing ones already filled from the fallback locale */
	messages: Partial<Record<Locale, Record<string, string>>>;
	/** loads the translations of a locale in the browser, which only fetches the locales it needs */
	load?: Partial<Record<Locale, () => Promise<{ default: Record<string, string> }>>>;
}

/**
 * Locale in the browser on startup: the one picked with `setLocale` on an earlier visit, else the
 * one the server rendered the page in (`<html lang>`), else the best match of the browser's
 * languages. Without a server hook (plain Vite apps), leave `lang` out of index.html.
 */
function initialLocale(): Locale {
	if (typeof document === 'undefined') return fallbackLocale;
	const cookie = document.cookie
		.split('; ')
		.find((c) => c.startsWith(localeCookie + '='))
		?.slice(localeCookie.length + 1);
	if (isLocale(cookie)) return cookie;
	if (isLocale(document.documentElement.lang)) return document.documentElement.lang;
	return negotiateLocale(undefined, navigator.languages.join(','));
}

let clientLocale: Locale = initialLocale();

/**
 * Makes `getLocale()` reactive in a UI framework. It gets a way to subscribe to locale changes
 * and returns a function that `getLocale()` calls on every read, e.g. to register a dependency
 * of the current component. The framework is picked with the `framework` option of the plugin.
 */
export type ReactivityAdapter = (subscribe: (onChange: () => void) => () => void) => () => void;

const listeners = new Set<() => void>();

/** Calls `listener` after every locale switch. Returns a function that removes it. */
export function onLocaleChange(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

const track = reactivity(onLocaleChange);

// Set by `handleLocale` so server code reads the locale of the current request.
let serverLocale: (() => Locale) | undefined;

export function setServerLocaleGetter(getter: () => Locale) {
	serverLocale = getter;
}

export function getLocale(): Locale {
	if (serverLocale) return serverLocale();
	track();
	return clientLocale;
}

// every file with translations loaded in the browser, to load their texts on locale changes
const files = new Set<FileMessages>();
let pendingLocale: Locale | undefined;

async function ensureLoaded(file: FileMessages, locale: Locale) {
	if (file.messages[locale]) return;
	file.messages[locale] = (await file.load?.[locale]?.())?.default ?? {};
}

/** Loads the translations of a file for the current locale before the file runs. */
export async function __load(file: FileMessages) {
	files.add(file);
	const needed = pendingLocale ? [clientLocale, pendingLocale] : [clientLocale];
	await Promise.all(needed.map((locale) => ensureLoaded(file, locale)));
	return file;
}

/** Loads the translations of every file used so far, then switches the locale. */
export async function setLocale(locale: Locale) {
	pendingLocale = locale;
	await Promise.all([...files].map((file) => ensureLoaded(file, locale)));
	if (pendingLocale !== locale) return; // another locale was picked meanwhile
	pendingLocale = undefined;
	clientLocale = locale;
	for (const listener of listeners) listener();
	document.documentElement.lang = locale;
	document.cookie = `${localeCookie}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Translates a text written in the source language: t`${count} trees`.
 *
 * The t0n vite plugin replaces every call with a lookup in the translations of the file it is
 * used in, so this implementation only runs when the plugin is missing.
 * Call it while rendering or handling a request, not at module top level.
 */
export function t(strings: TemplateStringsArray, ...values: unknown[]): string {
	return strings.reduce((text, part, i) => text + String(values[i - 1]) + part);
}

/** Lookup emitted by the t0n vite plugin. */
export function __t(
	file: FileMessages,
	key: string,
	message: string,
	values?: Record<string, unknown>
) {
	const text = file.messages[getLocale()]?.[key] || message;
	if (!values) return text;
	return text.replace(placeholderPattern, (match, name: string) =>
		name in values ? String(values[name]) : match
	);
}
