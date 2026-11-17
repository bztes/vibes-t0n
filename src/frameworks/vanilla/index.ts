import { fileURLToPath } from 'node:url';
import type { Framework } from '../../vite/types.js';

/** No UI framework: JS/TS/JSX only, re-render yourself via `onLocaleChange`. */
export const vanilla: Framework = {
	name: 'vanilla',
	languages: [],
	reactivity: fileURLToPath(new URL('./reactivity.js', import.meta.url))
};
