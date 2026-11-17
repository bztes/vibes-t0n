import { describe, expect, it } from 'vitest';
import { hash, lookup, message, outermost } from '../src/vite/extract.js';
import { script } from '../src/vite/script.js';

function parse(code: string) {
	return script.parse(code, 'file.ts').nodes;
}

function messages(code: string) {
	return parse(code).map((node) => message(code, node));
}

describe('collect', () => {
	it('finds only t`` tagged templates, sorted by position', () => {
		const code = 'b`x`; t`one`; obj.t`no`; `plain`; t(`call`); t`two`;';
		expect(messages(code)).toEqual(['one', 'two']);
	});

	it('finds t`` nested in other t``', () => {
		expect(messages('t`a ${t`b`} c`')).toEqual(['a {0} c', 'b']);
	});
});

describe('message', () => {
	it('names placeholders after plain property access', () => {
		expect(messages('t`Hello ${user.name}, you have ${count} trees`')).toEqual([
			'Hello {user.name}, you have {count} trees'
		]);
	});

	it('drops optional chaining from placeholder names', () => {
		expect(messages('t`Hi ${user?.name}`')).toEqual(['Hi {user.name}']);
	});

	it('numbers placeholders of other expressions by position', () => {
		expect(messages('t`${a} + ${b + c} = ${f()}`')).toEqual(['{a} + {1} = {2}']);
	});

	it('uses the cooked text, so escapes are resolved', () => {
		expect(messages('t`line\\none \\u00e9`')).toEqual(['line\none é']);
	});
});

describe('hash', () => {
	it('is a stable 8 character base64url string', () => {
		expect(hash('Hello')).toMatch(/^[\w-]{8}$/);
		expect(hash('Hello')).toBe(hash('Hello'));
		expect(hash('Hello')).not.toBe(hash('Hello '));
	});
});

describe('lookup', () => {
	it('rewrites a text without placeholders', () => {
		const code = 't`Hello`';
		const [node] = parse(code);
		expect(lookup(code, [node], node)).toBe(`__t(__i18n, "${hash('Hello')}", "Hello")`);
	});

	it('passes placeholder values', () => {
		const code = 't`Hi ${user?.name} and ${a + b}`';
		const [node] = parse(code);
		const text = 'Hi {user.name} and {1}';
		expect(lookup(code, [node], node)).toBe(
			`__t(__i18n, "${hash(text)}", ${JSON.stringify(text)}, { "user.name": (user?.name), "1": (a + b) })`
		);
	});

	it('rewrites t`` nested in placeholder values', () => {
		const code = 't`a ${t`b`}`';
		const nodes = parse(code);
		const top = outermost(nodes);
		expect(top).toHaveLength(1);
		expect(lookup(code, nodes, top[0])).toBe(
			`__t(__i18n, "${hash('a {0}')}", "a {0}", { "0": (__t(__i18n, "${hash('b')}", "b")) })`
		);
	});
});

describe('outermost', () => {
	it('skips nested nodes and nodes outside the range', () => {
		const code = 't`x`; t`a ${t`b`}`; t`y`';
		const nodes = parse(code);
		expect(outermost(nodes).map((n) => message(code, n))).toEqual(['x', 'a {0}', 'y']);
		expect(outermost(nodes, 5, code.length - 6).map((n) => message(code, n))).toEqual(['a {0}']);
	});
});
