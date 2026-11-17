import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

/*
 * Builds the studio UI (src/studio/ui) into dist/studio/ui, which `t0n studio` serves.
 * `pnpm dev:studio` serves it with hot reload; it talks to a studio started with `pnpm studio`.
 */
export default defineConfig({
	root: 'src/studio/ui',
	base: './',
	plugins: [svelte()],
	build: { outDir: '../../../dist/studio/ui', emptyOutDir: true },
	server: { proxy: { '/api': 'http://127.0.0.1:4983' } }
});
