import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The runtime (src/index.ts, src/config.ts) imports modules that the t0n plugin normally provides.
const virtual: Record<string, string> = {
	'virtual:t0n-config': `export const fallbackLocale = 'en'; export const locales = ['en', 'de', 'fr'];`,
	'virtual:t0n-reactivity': `export { default } from ${JSON.stringify(
		fileURLToPath(new URL('./src/frameworks/vanilla/reactivity.ts', import.meta.url))
	)};`
};

export default defineConfig({
	plugins: [
		{
			name: 't0n-test-virtual',
			resolveId: (id) => (id in virtual ? '\0' + id : undefined),
			load: (id) => (id.startsWith('\0') ? virtual[id.slice(1)] : undefined)
		}
	],
	test: {
		include: ['test/**/*.test.ts']
	}
});
