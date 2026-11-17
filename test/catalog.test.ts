import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	alignGroup,
	catalogFile,
	codeCatalog,
	findLocales,
	readCatalog,
	writeCatalog
} from '../src/catalog.js';

let dir: string;

beforeEach(() => {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0n-'));
});

afterEach(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

describe('findLocales', () => {
	it('is only the fallback locale without a locales directory', () => {
		expect(findLocales(path.join(dir, 'missing'), 'en')).toEqual(['en']);
	});

	it('lists the fallback locale first, then the others sorted, without the code catalog', () => {
		for (const name of ['fr', 'en', codeCatalog, 'de']) {
			fs.writeFileSync(catalogFile(dir, name), '{}');
		}
		fs.writeFileSync(path.join(dir, 'notes.txt'), '');
		expect(findLocales(dir, 'en')).toEqual(['en', 'de', 'fr']);
	});
});

describe('readCatalog', () => {
	it('is empty for missing and blank files', () => {
		fs.writeFileSync(catalogFile(dir, 'de'), '  \n');
		expect(readCatalog(dir, 'de')).toEqual({});
		expect(readCatalog(dir, 'fr')).toEqual({});
	});

	it('throws on invalid JSON', () => {
		fs.writeFileSync(catalogFile(dir, 'de'), '{');
		expect(() => readCatalog(dir, 'de')).toThrow(SyntaxError);
	});
});

describe('writeCatalog', () => {
	it('writes the groups sorted, creating the directory', () => {
		const localesDir = path.join(dir, 'locales');
		writeCatalog(localesDir, 'de', { 'b.ts': { k: 'B' }, 'a.ts': { k: 'A' } });
		const text = fs.readFileSync(catalogFile(localesDir, 'de'), 'utf8');
		expect(text).toBe('{\n\t"a.ts": {\n\t\t"k": "A"\n\t},\n\t"b.ts": {\n\t\t"k": "B"\n\t}\n}\n');
		expect(readCatalog(localesDir, 'de')).toEqual({ 'a.ts': { k: 'A' }, 'b.ts': { k: 'B' } });
	});

	it('leaves the file untouched if its content is unchanged', () => {
		const catalog = { 'a.ts': { k: 'A' } };
		writeCatalog(dir, 'de', catalog);
		const file = catalogFile(dir, 'de');
		const past = new Date(2000, 0, 1);
		fs.utimesSync(file, past, past);

		writeCatalog(dir, 'de', catalog);
		expect(fs.statSync(file).mtime).toEqual(past);

		writeCatalog(dir, 'de', { 'a.ts': { k: 'changed' } });
		expect(fs.statSync(file).mtime).not.toEqual(past);
	});
});

describe('alignGroup', () => {
	it('keeps existing translations, adds missing ones empty and drops removed ones', () => {
		const code = { a: 'Hello', b: 'Bye' };
		expect(alignGroup(code, { a: 'Hallo', old: 'Alt' })).toEqual({ a: 'Hallo', b: '' });
		expect(alignGroup(code)).toEqual({ a: '', b: '' });
	});
});
