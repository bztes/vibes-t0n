import MagicString from 'magic-string';
import { describe, expect, it } from 'vitest';
import { svelte } from '../src/frameworks/svelte/index.js';
import { message } from '../src/vite/extract.js';
import { script } from '../src/vite/script.js';

const imports = 'import __i18n from "x";';

function withImports(code: string, add: (s: MagicString, imports: string) => void) {
	const s = new MagicString(code);
	add(s, imports);
	return s.toString();
}

describe('script', () => {
	it('throws on syntax errors', () => {
		expect(() => script.parse('t`a', 'file.js')).toThrow();
	});

	it('parses TSX', () => {
		const code = 'const el = <p title={t`Title`}>{t`Body`}</p>;';
		const { nodes } = script.parse(code, 'file.tsx');
		expect(nodes.map((n) => message(code, n))).toEqual(['Title', 'Body']);
	});

	it('prepends imports', () => {
		const code = 'const a = 1;';
		const { addImports } = script.parse(code, 'file.ts');
		expect(withImports(code, addImports)).toBe(`${imports}\nconst a = 1;`);
	});

	it('adds imports after directives', () => {
		const code = "'use client';\n'use strict';\nconst a = 1;";
		const { addImports } = script.parse(code, 'file.ts');
		expect(withImports(code, addImports)).toBe(
			`'use client';\n'use strict';\n${imports}\nconst a = 1;`
		);
	});
});

describe('svelte', () => {
	const [svelteFiles] = svelte.languages;

	it('finds t`` in scripts and markup', () => {
		const code = [
			'<script module>const a = t`module`;</script>',
			'<script>const b = t`instance`;</script>',
			'<p title={t`attribute`}>{t`text ${name}`}</p>',
			'<style>p { color: red; }</style>'
		].join('\n');
		const { nodes } = svelteFiles.parse(code, 'App.svelte');
		expect(nodes.map((n) => message(code, n))).toEqual([
			'module',
			'instance',
			'attribute',
			'text {name}'
		]);
	});

	it('adds imports to the module script if there is one', () => {
		const code = '<script>let a;</script>\n<script module>let b;</script>';
		const { addImports } = svelteFiles.parse(code, 'App.svelte');
		expect(withImports(code, addImports)).toBe(
			`<script>let a;</script>\n<script module>\n${imports}let b;</script>`
		);
	});

	it('adds imports to the instance script', () => {
		const code = '<script>let a;</script>';
		const { addImports } = svelteFiles.parse(code, 'App.svelte');
		expect(withImports(code, addImports)).toBe(`<script>\n${imports}let a;</script>`);
	});

	it('adds a script for the imports if there is none', () => {
		const code = '<p>{t`Hi`}</p>';
		const { addImports } = svelteFiles.parse(code, 'App.svelte');
		expect(withImports(code, addImports)).toBe(`<script>\n${imports}\n</script>\n${code}`);
	});
});
