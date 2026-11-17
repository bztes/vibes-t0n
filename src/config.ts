/// <reference path="./virtual.d.ts" />
import * as config from 'virtual:t0n-config';

export type Locale = string;

/** Locale used for missing translations and when none of the user's languages is supported. */
export const fallbackLocale: Locale = config.fallbackLocale;

/** Fallback locale first, then every locale with a file in the locales directory. */
export const locales: readonly Locale[] = config.locales;

function displayName(locale: Locale) {
	try {
		const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
		return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
	} catch {
		return locale;
	}
}

/** Name of every locale in its own language, e.g. { en: 'English', de: 'Deutsch' }. */
export const localeNames: Record<Locale, string> = Object.fromEntries(
	locales.map((l) => [l, displayName(l)])
);

/** Cookie that stores the locale picked with `setLocale`. */
export const localeCookie = 'locale';

export function isLocale(value: unknown): value is Locale {
	return locales.includes(value as Locale);
}

/**
 * Locale of a request, framework independent: the value of the `locale` cookie set by
 * `setLocale` if it is supported, else the best match of the Accept-Language header.
 * Server integrations (SvelteKit, Nuxt, Next, …) only need to read those two values.
 */
export function negotiateLocale(
	cookie: string | null | undefined,
	acceptLanguage: string | null | undefined
): Locale {
	if (isLocale(cookie)) return cookie;

	// e.g. "de-CH,de;q=0.9,en;q=0.8"
	const accepted = (acceptLanguage ?? '')
		.split(',')
		.map((part) => {
			const [tag, q] = part.trim().split(';q=');
			return { lang: tag.split('-')[0].toLowerCase(), q: q ? Number(q) : 1 };
		})
		.sort((a, b) => b.q - a.q);

	return accepted.map((a) => a.lang).find(isLocale) ?? fallbackLocale;
}
