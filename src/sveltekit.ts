import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getRequestEvent } from '$app/server';
import { fallbackLocale, type Locale } from './config.js';
import { localeCookie, negotiateLocale, setServerLocaleGetter } from './server.js';

declare global {
	namespace App {
		interface Locals {
			/** Locale of the current request, set by `handleLocale`. */
			locale: string;
		}
	}
}

setServerLocaleGetter(() => {
	try {
		return getRequestEvent().locals.locale ?? fallbackLocale;
	} catch {
		return fallbackLocale;
	}
});

/** Locale from the cookie set by `setLocale`, else the best match of the Accept-Language header. */
export function detectLocale({ cookies, request }: RequestEvent): Locale {
	return negotiateLocale(cookies.get(localeCookie), request.headers.get('accept-language'));
}

/**
 * Server hook that detects the locale of each request, stores it in `event.locals.locale` and
 * replaces `%lang%` in app.html with it, e.g. `<html lang="%lang%">`.
 */
export const handleLocale: Handle = ({ event, resolve }) => {
	const locale = detectLocale(event);
	event.locals.locale = locale;
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', locale)
	});
};
