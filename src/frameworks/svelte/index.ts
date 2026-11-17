import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';
import { collect } from '../../vite/extract.js';
import type { Framework, Node, SourceLanguage } from '../../vite/types.js';

/** .svelte components: t`` in <script>, <script module> and the markup. */
const svelteFiles: SourceLanguage = {
	extensions: ['.svelte'],
	parse(code) {
		const ast = parse(code, { modern: true });
		// the module script if there is one, so the imports are also visible there
		const script = ast.module ?? ast.instance;
		return {
			nodes: collect(ast, (node) => node.type === 'StyleSheet'),
			addImports(s, imports) {
				if (script) s.appendLeft((script.content as unknown as Node).start, '\n' + imports);
				else s.prepend(`<script>\n${imports}\n</script>\n`);
			}
		};
	}
};

export const svelte: Framework = {
	name: 'svelte',
	languages: [svelteFiles],
	reactivity: fileURLToPath(new URL('./reactivity.js', import.meta.url))
};
