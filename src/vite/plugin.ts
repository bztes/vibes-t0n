import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MagicString from 'magic-string';
import { normalizePath, type Plugin } from 'vite';
import {
	alignGroup,
	catalogFile,
	codeCatalog,
	findLocales,
	readCatalog,
	writeCatalog,
	type Catalog
} from '../catalog.js';
import { defaultFallbackLocale, defaultLocalesDir } from '../format.js';
import { hash, lookup, message, outermost } from './extract.js';
import { script } from './script.js';
import type { Framework, ParsedSource, SourceLanguage } from './types.js';

/*
 * Finds every t`...` in src/, collects the texts into locales/<locale>.json, grouped by source
 * file and keyed by a short hash of the text, and rewrites each call into a lookup in that file's
 * translations (see extract.ts).
 *
 * Framework specific parts are behind `Framework` (types.ts): the file types besides JS/TS that
 * contain t`` and the adapter that makes `getLocale()` reactive. Everything else is shared.
 *
 * `__i18n` is a module per source file. On the server it holds the translations of every locale;
 * in the browser it loads only the current locale (one chunk per file and locale) with a top-level
 * await, so the file renders synchronously once imported. The fallback is applied at build time,
 * so each chunk is complete on its own, and texts equal to the code are left out, as the lookup
 * already contains them.
 *
 * The supported locales are the fallback locale plus every locales/<locale>.json, so adding a
 * language is creating an empty file for it. locales/_t0n.json is not a locale: it is generated
 * with every text as it is in the code, to look up which text a hash belongs to.
 */

const runtime = fileURLToPath(new URL('../index.js', import.meta.url));

// virtual:t0n:<file> holds the translations of a file, virtual:t0n:<file>:<locale> those of one
// locale. <file> is the path relative to srcDir, base64url encoded: SvelteKit treats every id
// containing ".remote." as remote module, and the ids end up in chunk names, so they must be short.
const virtualPrefix = 'virtual:t0n:';
const configId = 'virtual:t0n-config';
const reactivityId = 'virtual:t0n-reactivity';

/** Frameworks that ship with t0n, loaded on demand so their compilers stay optional. */
const builtin = {
	svelte: async () => (await import('../frameworks/svelte/index.js')).svelte,
	vanilla: async () => (await import('../frameworks/vanilla/index.js')).vanilla
} satisfies Record<string, () => Promise<Framework>>;

export type FrameworkName = keyof typeof builtin;

export interface T0nOptions {
	/** UI framework of the app, a built-in name or a custom `Framework`. Default: 'svelte'. */
	framework?: FrameworkName | Framework;
	/** Locale used for missing translations and when none of the user's languages is supported. Default: 'en'. */
	fallbackLocale?: string;
	/** Directory with the source files to translate, relative to the vite root. Default: 'src'. */
	srcDir?: string;
	/** Directory with the <locale>.json catalogs, relative to the vite root. Default: 'locales'. */
	localesDir?: string;
}

export function t0n(options: T0nOptions = {}): Plugin {
	const { fallbackLocale = defaultFallbackLocale } = options;
	let framework: Framework;
	let languages: SourceLanguage[];
	let srcDir: string;
	let localesDir: string;
	/** fallback locale first, then every locale with a file in locales/ */
	let locales: string[];
	let scanned = false;
	/** content of every loaded virtual module, per environment and id, to only update what changed */
	const loaded = new Map<string, Map<string, string>>();
	/** texts of every file as last written to the catalogs, to skip unchanged ones */
	const synced = new Map<string, string>();

	const group = (file: string) => normalizePath(path.relative(srcDir, file));
	const virtualId = (file: string, locale?: string) =>
		virtualPrefix + Buffer.from(group(file)).toString('base64url') + (locale ? `:${locale}` : '');
	/** Inverse of `virtualId`, for the resolved id. */
	function parseVirtualId(id: string) {
		const [encoded, locale] = id.slice(('\0' + virtualPrefix).length).split(':');
		return { file: path.join(srcDir, Buffer.from(encoded, 'base64url').toString()), locale };
	}
	const localeFile = (locale: string) => catalogFile(localesDir, locale);
	const languageOf = (file: string) =>
		languages.find((l) => l.extensions.some((ext) => file.endsWith(ext)));

	/** Group of a file in the code catalog: hash → text, empty if the file has no texts. */
	function codeGroup(parsed: ParsedSource, code: string) {
		const messages = parsed.nodes.map((n) => message(code, n));
		return Object.fromEntries(messages.map((m) => [hash(m), m]));
	}

	/** Makes group `key` of `catalog` contain exactly the texts of `code`, keeping translations. */
	function setGroup(catalog: Catalog, locale: string, key: string, code: Record<string, string>) {
		if (!Object.keys(code).length) delete catalog[key];
		else catalog[key] = locale === codeCatalog ? code : alignGroup(code, catalog[key]);
	}

	/** Writes the texts of `file` into every catalog, unless they are the same as last time. */
	function sync(file: string, code: Record<string, string>) {
		const key = group(file);
		const signature = JSON.stringify(code);
		if (synced.get(key) === signature) return;
		for (const locale of [...locales, codeCatalog]) {
			const catalog = readCatalog(localesDir, locale);
			if (!(key in catalog) && !Object.keys(code).length) continue;
			setGroup(catalog, locale, key, code);
			writeCatalog(localesDir, locale, catalog);
		}
		synced.set(key, signature);
	}

	function extract(language: SourceLanguage, code: string, id: string) {
		const parsed = language.parse(code, id);
		sync(id, codeGroup(parsed, code));
		return parsed;
	}

	/**
	 * Extracts all files once, so the catalogs are complete and groups of deleted files removed.
	 * Reads and writes each catalog once, however many files there are.
	 */
	function scan() {
		const extensions = languages.flatMap((l) => l.extensions.map((e) => e.slice(1)));
		/** group of every file that parsed; files without texts have an empty one */
		const groups = new Map<string, Record<string, string>>();
		/** files with syntax errors, whose groups stay as they are */
		const unparsed = new Set<string>();
		for (const rel of fs.globSync(`**/*.{${extensions.join(',')}}`, { cwd: srcDir })) {
			const file = path.join(srcDir, rel);
			const language = languageOf(file);
			if (!language) continue;
			const code = fs.readFileSync(file, 'utf8');
			if (!code.includes('t`')) continue;
			try {
				groups.set(group(file), codeGroup(language.parse(code, file), code));
			} catch {
				unparsed.add(group(file)); // Syntax errors get reported when the file is transformed.
			}
		}
		for (const locale of [...locales, codeCatalog]) {
			const catalog = readCatalog(localesDir, locale);
			for (const key of Object.keys(catalog))
				if (!groups.has(key) && !unparsed.has(key)) delete catalog[key];
			for (const [key, code] of groups) setGroup(catalog, locale, key, code);
			writeCatalog(localesDir, locale, catalog);
		}
		for (const [key, code] of groups) synced.set(key, JSON.stringify(code));
	}

	/**
	 * Texts of `file` in `locale`, missing ones taken from the fallback locale. Texts equal to the
	 * code (the key is their hash) are left out.
	 */
	function translations(file: string, locale: string) {
		const own = readCatalog(localesDir, locale)[group(file)] ?? {};
		const fallback = readCatalog(localesDir, fallbackLocale)[group(file)] ?? {};
		const result: Record<string, string> = {};
		for (const key of Object.keys({ ...fallback, ...own })) {
			const text = own[key] || fallback[key];
			if (text && hash(text) !== key) result[key] = text;
		}
		return result;
	}

	/** Code of a virtual translation module, see the top of this file. */
	function moduleCode(id: string, environment: string) {
		const { file, locale } = parseVirtualId(id);
		if (locale) return `export default ${JSON.stringify(translations(file, locale))};`;
		if (environment !== 'client') {
			const messages = Object.fromEntries(locales.map((l) => [l, translations(file, l)]));
			return `export default { messages: ${JSON.stringify(messages)} };`;
		}
		const load = locales.map(
			(l) => `${JSON.stringify(l)}: () => import(${JSON.stringify(virtualId(file, l))})`
		);
		return (
			`import { __load } from ${JSON.stringify(runtime)};\n` +
			`export default await __load({ messages: {}, load: { ${load.join(', ')} } });`
		);
	}

	return {
		name: 't0n',
		enforce: 'pre',
		config: () => ({
			// The runtime imports virtual modules, which only this plugin can resolve, and holds
			// the locale state, which must not be duplicated by pre-bundling or externalizing it.
			optimizeDeps: { exclude: ['@bztes/vibes-t0n'] },
			ssr: { noExternal: ['@bztes/vibes-t0n'] }
		}),
		async configResolved(config) {
			const chosen = options.framework ?? 'svelte';
			framework = typeof chosen === 'string' ? await builtin[chosen]() : chosen;
			languages = [script, ...framework.languages];
			srcDir = path.resolve(config.root, options.srcDir ?? 'src');
			localesDir = path.resolve(config.root, options.localesDir ?? defaultLocalesDir);
			locales = findLocales(localesDir, fallbackLocale);
		},
		configureServer(server) {
			// Adding or removing a language changes the config and every translation module.
			const onChange = (file: string) => {
				if (path.dirname(file) !== localesDir || path.extname(file) !== '.json') return;
				if (path.basename(file, '.json') === codeCatalog) return;
				const exists = fs.existsSync(file);
				if (locales.includes(path.basename(file, '.json')) === exists) return;
				server.config.logger.info(`t0n: locales changed, restarting server`);
				void server.restart();
			};
			server.watcher.add(localesDir);
			server.watcher.on('add', onChange).on('unlink', onChange);
		},
		resolveId: {
			filter: { id: /^virtual:t0n[:-]/ },
			handler: (id) => '\0' + id
		},
		load: {
			filter: { id: /^\0virtual:t0n[:-]/ },
			handler(id) {
				if (id === '\0' + configId) {
					return `export const fallbackLocale = ${JSON.stringify(fallbackLocale)};\nexport const locales = ${JSON.stringify(locales)};`;
				}
				if (id === '\0' + reactivityId) {
					return `export { default } from ${JSON.stringify(framework.reactivity)};`;
				}
				for (const locale of locales) this.addWatchFile(localeFile(locale));
				const { name } = this.environment;
				const code = moduleCode(id, name);
				if (!loaded.has(name)) loaded.set(name, new Map());
				loaded.get(name)!.set(id, code);
				return code;
			}
		},
		hotUpdate({ file }) {
			if (!locales.some((l) => file === localeFile(l))) return;
			const { moduleGraph, name } = this.environment;
			const changed = [];
			for (const [id, code] of loaded.get(name) ?? []) {
				const mod = moduleGraph.getModuleById(id);
				if (!mod || moduleCode(id, name) === code) continue;
				moduleGraph.invalidateModule(mod);
				changed.push(mod);
			}
			return changed;
		},
		buildStart() {
			if (scanned) return;
			scanned = true;
			scan();
		},
		transform: {
			// the file type is checked in the handler, as the framework is only known once resolved
			filter: { code: 't`' },
			handler(code, id) {
				if (!id.startsWith(srcDir + path.sep)) return;
				const language = languageOf(id);
				if (!language) return;

				let parsed;
				try {
					parsed = extract(language, code, id);
				} catch {
					return; // let the regular compiler report the syntax error
				}
				if (!parsed.nodes.length) return;

				const s = new MagicString(code);
				// nested ones are part of the outer lookup
				for (const node of outermost(parsed.nodes))
					s.overwrite(node.start, node.end, lookup(code, parsed.nodes, node));

				parsed.addImports(
					s,
					`import { __t } from ${JSON.stringify(runtime)}; ` +
						`import __i18n from ${JSON.stringify(virtualId(id))};`
				);

				return { code: s.toString(), map: s.generateMap({ hires: 'boundary', source: id }) };
			}
		}
	};
}
