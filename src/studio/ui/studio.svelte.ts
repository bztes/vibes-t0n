import { createContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Snapshot } from '../api.js';

export interface Row {
	key: string;
	source: string;
}

const cellId = (locale: string, file: string, key: string) => `${locale}\0${file}\0${key}`;
const storageKey = 't0n-locale';

/** Calls the studio API (see ../server.ts), throwing the server's error message if it fails. */
async function request(method: string, url: string, body?: unknown) {
	const res = await fetch(
		url,
		body === undefined
			? { method }
			: { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
	);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
	return data;
}

/** State of the studio: the catalogs, unsaved edits and what is shown, one locale at a time. */
export class Studio {
	data = $state.raw<Snapshot>();
	query = $state('');
	missingOnly = $state(false);
	status = $state({ text: '', error: false });

	/** locale picked to translate, remembered per browser */
	#selected = $state('');
	/** edits not saved yet; they win over reloaded catalogs. Saving unless failed. */
	#drafts = new SvelteMap<string, string>();
	#failed = new SvelteSet<string>();
	#timers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor() {
		try {
			this.#selected = localStorage.getItem(storageKey) ?? '';
		} catch {
			// private mode: fall back to the default locale
		}
	}

	/** The one locale being translated; defaults to the first one that is not the fallback. */
	locale = $derived.by(() => {
		const all = this.data?.locales ?? [];
		if (all.includes(this.#selected)) return this.#selected;
		return all.find((l) => l !== this.data?.fallbackLocale) ?? all[0] ?? '';
	});

	select(locale: string) {
		this.#selected = locale;
		try {
			localStorage.setItem(storageKey, locale);
		} catch {
			// not remembered, which is fine
		}
	}

	/** Source files sorted, each with its texts. */
	files = $derived(
		Object.entries(this.data?.source ?? {})
			.sort(([a], [b]) => (a < b ? -1 : 1))
			.map(([file, texts]) => ({
				file,
				rows: Object.entries(texts).map(([key, source]): Row => ({ key, source }))
			}))
	);

	/** Files and texts matching the search and the "missing only" filter. */
	visible = $derived.by(() => {
		const query = this.query.trim().toLowerCase();
		return this.files
			.map(({ file, rows }) => ({
				file,
				rows: rows.filter(({ key, source }) => {
					if (this.missingOnly && !this.isMissing(this.locale, file, key)) return false;
					if (!query) return true;
					const haystack = [file, source, this.value(this.locale, file, key)];
					return haystack.some((text) => text.toLowerCase().includes(query));
				})
			}))
			.filter(({ rows }) => rows.length);
	});

	value(locale: string, file: string, key: string) {
		return (
			this.#drafts.get(cellId(locale, file, key)) ??
			this.data?.translations[locale]?.[file]?.[key] ??
			''
		);
	}

	/** The fallback locale may stay empty: it then shows the text in the code. */
	isMissing(locale: string, file: string, key: string) {
		return locale !== this.data?.fallbackLocale && !this.value(locale, file, key);
	}

	/** Number of texts per file missing a translation in the selected locale. */
	missingByFile = $derived(
		Object.fromEntries(
			this.files.map(({ file, rows }) => [
				file,
				rows.filter(({ key }) => this.isMissing(this.locale, file, key)).length
			])
		)
	);

	/** Share of texts translated per locale, from 0 to 1. */
	progress = $derived.by(() => {
		const texts = this.files.flatMap(({ file, rows }) => rows.map(({ key }) => ({ file, key })));
		return Object.fromEntries(
			(this.data?.locales ?? []).map((locale) => {
				const done = texts.filter(({ file, key }) => !this.isMissing(locale, file, key)).length;
				return [locale, texts.length ? done / texts.length : 1];
			})
		);
	});

	cellState(locale: string, file: string, key: string) {
		const id = cellId(locale, file, key);
		const failed = this.#failed.has(id);
		return { saving: this.#drafts.has(id) && !failed, failed };
	}

	#setStatus(text: string, error = false) {
		this.status = { text, error };
	}

	async load() {
		try {
			this.data = await request('GET', '/api/catalogs');
		} catch (error) {
			this.#setStatus(`Could not load catalogs: ${(error as Error).message}`, true);
		}
	}

	/** Saves a translation shortly after the last keystroke. */
	edit(locale: string, file: string, key: string, text: string) {
		const id = cellId(locale, file, key);
		this.#drafts.set(id, text);
		this.#failed.delete(id);
		clearTimeout(this.#timers.get(id));
		this.#timers.set(
			id,
			setTimeout(() => this.#save(id, locale, file, key, text), 400)
		);
	}

	async #save(id: string, locale: string, file: string, key: string, text: string) {
		this.#setStatus('Saving…');
		try {
			await request('PUT', '/api/text', { locale, file, key, text });
			this.#patch(locale, file, key, text);
			if (this.#drafts.get(id) === text) this.#drafts.delete(id);
			this.#failed.delete(id);
			this.#setStatus('Saved');
		} catch (error) {
			this.#failed.add(id);
			this.#setStatus(`Not saved: ${(error as Error).message}`, true);
		}
	}

	/** Puts a saved text into `data`, which is only ever replaced, not mutated. */
	#patch(locale: string, file: string, key: string, text: string) {
		if (!this.data) return;
		const catalog = this.data.translations[locale] ?? {};
		this.data = {
			...this.data,
			translations: {
				...this.data.translations,
				[locale]: { ...catalog, [file]: { ...catalog[file], [key]: text } }
			}
		};
	}

	/** Adds a language; throws the reason if that fails. */
	async addLocale(locale: string) {
		await request('POST', '/api/locales', { locale });
		this.select(locale);
		this.#setStatus(`Added ${locale}`);
		await this.load();
	}

	/**
	 * Reloads whenever a catalog changes on disk, e.g. when the vite plugin picks up new texts.
	 * Returns a function that stops listening.
	 */
	listen() {
		const events = new EventSource('/api/events');
		let lost = false;
		events.addEventListener('change', () => this.load());
		events.addEventListener('error', () => {
			lost = true;
			this.#setStatus('Disconnected from studio', true);
		});
		events.addEventListener('open', () => {
			if (!lost) return;
			lost = false;
			this.#setStatus('Connected');
			void this.load();
		});
		return () => events.close();
	}
}

export const [getStudio, setStudio] = createContext<Studio>();
