import { parseSync } from 'vite';
import { collect } from './extract.js';
import type { Node, SourceLanguage } from './types.js';

/** Plain JS/TS modules, including JSX/TSX (e.g. React components). */
export const script: SourceLanguage = {
	extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx'],
	parse(code, id) {
		// the language (js, jsx, ts, tsx) follows from the extension of `id`
		const { program, errors } = parseSync(id, code);
		if (errors.length) throw new Error(errors[0].message);

		// Imports go after directives like 'use client', which must stay first.
		const body = program.body as unknown as (Node & { directive?: string | null })[];
		let end = 0;
		for (const statement of body) {
			if (!statement.directive) break;
			end = statement.end;
		}

		return {
			nodes: collect(program),
			addImports: (s, imports) =>
				end ? s.appendLeft(end, '\n' + imports) : s.prepend(imports + '\n')
		};
	}
};
