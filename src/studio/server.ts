import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	alignGroup,
	codeCatalog,
	findLocales,
	readCatalog,
	writeCatalog,
	type Catalog
} from '../catalog.js';
import { defaultFallbackLocale, defaultLocalesDir } from '../format.js';
import type { Snapshot } from './api.js';

/*
 * Local web UI to edit the catalogs in locales/, started with `t0n studio`.
 *
 *   GET  /              the UI, a Svelte app in ./ui
 *   GET  /api/catalogs  texts in the code plus every locale's translations
 *   PUT  /api/text      { locale, file, key, text } sets one translation
 *   POST /api/locales   { locale } adds a language with every text untranslated
 *   GET  /api/events    server-sent "change" events whenever a catalog changes on disk
 *
 * The catalogs stay the source of truth: the vite plugin may rewrite them at any time (when
 * sources change), so every write reads the file again and only touches the one text, and the UI
 * reloads on change events.
 */

export interface StudioOptions {
	/** Directory with the <locale>.json catalogs. Default: 'locales'. */
	localesDir?: string;
	/** Same as the plugin's `fallbackLocale`. Default: 'en'. */
	fallbackLocale?: string;
	/** Default: 4983. */
	port?: number;
	/** Default: '127.0.0.1', so the studio is not reachable from other machines. */
	host?: string;
}

/** The built Svelte app (src/studio/ui), see vite.studio.config.ts. */
const ui = fileURLToPath(new URL('./ui/', import.meta.url));
const contentTypes: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml'
};
const validLocale = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;

export function studio(options: StudioOptions = {}) {
	const localesDir = path.resolve(options.localesDir ?? defaultLocalesDir);
	const fallbackLocale = options.fallbackLocale ?? defaultFallbackLocale;
	const host = options.host ?? '127.0.0.1';
	const port = options.port ?? 4983;

	const clients = new Set<http.ServerResponse>();

	function snapshot(): Snapshot {
		const locales = findLocales(localesDir, fallbackLocale);
		const translations: Record<string, Catalog> = {};
		for (const locale of locales) translations[locale] = readCatalog(localesDir, locale);
		return {
			localesDir,
			fallbackLocale,
			locales,
			source: readCatalog(localesDir, codeCatalog),
			translations
		};
	}

	function setText(body: Record<string, unknown>) {
		const { locale, file, key, text } = body;
		if (typeof locale !== 'string' || typeof file !== 'string' || typeof key !== 'string')
			return 'locale, file and key are required';
		if (typeof text !== 'string') return 'text must be a string';
		if (!findLocales(localesDir, fallbackLocale).includes(locale))
			return `unknown locale ${locale}`;
		// only texts that exist in the code, so a typo can't add garbage to the catalogs
		if (readCatalog(localesDir, codeCatalog)[file]?.[key] === undefined)
			return `unknown text ${file} ${key}`;
		const catalog = readCatalog(localesDir, locale);
		(catalog[file] ??= {})[key] = text;
		writeCatalog(localesDir, locale, catalog);
	}

	function addLocale(body: Record<string, unknown>) {
		const { locale } = body;
		// also rules out codeCatalog, which starts with an underscore
		if (typeof locale !== 'string' || !validLocale.test(locale)) return 'invalid locale';
		if (findLocales(localesDir, fallbackLocale).includes(locale)) return `${locale} exists already`;
		const source = readCatalog(localesDir, codeCatalog);
		const empty: Catalog = Object.fromEntries(
			Object.entries(source).map(([file, texts]) => [file, alignGroup(texts)])
		);
		writeCatalog(localesDir, locale, empty);
	}

	async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
		let raw = '';
		for await (const chunk of req) {
			raw += chunk;
			if (raw.length > 1_000_000) throw new Error('body too large');
		}
		const value = JSON.parse(raw || '{}');
		return value && typeof value === 'object' ? value : {};
	}

	function send(res: http.ServerResponse, status: number, body: unknown) {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(JSON.stringify(body));
	}

	function serveUi(pathname: string, res: http.ServerResponse) {
		const file = path.join(ui, path.normalize(decodeURIComponent(pathname)));
		const target =
			file.startsWith(ui) && fs.statSync(file, { throwIfNoEntry: false })?.isFile()
				? file
				: path.join(ui, 'index.html');
		res.writeHead(200, {
			'content-type': contentTypes[path.extname(target)] ?? 'application/octet-stream'
		});
		fs.createReadStream(target).pipe(res);
	}

	/** JSON endpoints: each handler returns an error message or nothing. */
	const actions: Record<string, (body: Record<string, unknown>) => string | undefined> = {
		'PUT /api/text': setText,
		'POST /api/locales': addLocale
	};

	const server = http.createServer(async (req, res) => {
		const url = new URL(req.url ?? '/', 'http://localhost');
		try {
			// Only the UI itself may write: blocks other sites from posting to localhost.
			const origin = req.headers.origin;
			if (req.method !== 'GET' && origin && new URL(origin).host !== req.headers.host)
				return send(res, 403, { error: 'cross-origin request' });

			if (req.method === 'GET' && url.pathname === '/api/catalogs')
				return send(res, 200, snapshot());
			const action = actions[`${req.method} ${url.pathname}`];
			if (action) {
				const error = action(await readJson(req));
				return error ? send(res, 400, { error }) : send(res, 200, { ok: true });
			}
			if (req.method === 'GET' && url.pathname === '/api/events') {
				res.writeHead(200, {
					'content-type': 'text/event-stream',
					'cache-control': 'no-cache',
					connection: 'keep-alive'
				});
				res.write(': connected\n\n');
				clients.add(res);
				req.on('close', () => clients.delete(res));
				return;
			}
			if (req.method === 'GET' && !url.pathname.startsWith('/api/'))
				return serveUi(url.pathname, res);
			send(res, 404, { error: 'not found' });
		} catch (error) {
			send(res, 500, { error: error instanceof Error ? error.message : String(error) });
		}
	});

	// Debounced, as one save can fire several fs events.
	let timer: NodeJS.Timeout | undefined;
	fs.mkdirSync(localesDir, { recursive: true });
	const watcher = fs.watch(localesDir, (_, name) => {
		if (name && !name.endsWith('.json')) return;
		clearTimeout(timer);
		timer = setTimeout(() => {
			for (const client of clients) client.write('event: change\ndata: {}\n\n');
		}, 50);
	});

	return new Promise<{ url: string; close: () => void }>((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, host, () => {
			resolve({
				url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`,
				close: () => {
					watcher.close();
					for (const client of clients) client.end();
					server.close();
				}
			});
		});
	});
}
