import fs from 'node:fs';
import path from 'node:path';
import type { Catalog } from './format.js';

export type { Catalog };

/*
 * Reading and writing locales/<locale>.json. Node only; shared by the vite plugin and the studio.
 */

/** Catalog of the texts in the code, written next to the locales but not one of them. */
export const codeCatalog = '_t0n';

export function catalogFile(localesDir: string, locale: string) {
	return path.join(localesDir, `${locale}.json`);
}

/** Fallback locale first, then every locale with a file in `localesDir`, sorted. */
export function findLocales(localesDir: string, fallbackLocale: string): string[] {
	const found = fs.existsSync(localesDir)
		? fs.globSync('*.json', { cwd: localesDir }).map((f) => path.basename(f, '.json'))
		: [];
	const others = found.filter((l) => l !== fallbackLocale && l !== codeCatalog);
	return [fallbackLocale, ...others.sort()];
}

export function readCatalog(localesDir: string, locale: string): Catalog {
	const target = catalogFile(localesDir, locale);
	const text = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
	return text.trim() ? JSON.parse(text) : {};
}

/** Writes the catalog with sorted groups, unless the file already has exactly that content. */
export function writeCatalog(localesDir: string, locale: string, catalog: Catalog) {
	const target = catalogFile(localesDir, locale);
	const sorted = Object.fromEntries(Object.entries(catalog).sort(([a], [b]) => (a < b ? -1 : 1)));
	const text = JSON.stringify(sorted, null, '\t') + '\n';
	if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) return;
	fs.mkdirSync(localesDir, { recursive: true });
	fs.writeFileSync(target, text);
}

/**
 * A locale's group for one source file with exactly the texts of `code` (the group in the code
 * catalog), keeping existing translations and leaving new ones empty.
 */
export function alignGroup(code: Record<string, string>, existing: Record<string, string> = {}) {
	return Object.fromEntries(Object.keys(code).map((key) => [key, existing[key] ?? '']));
}
