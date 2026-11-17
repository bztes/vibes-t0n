import type { Catalog } from '../format.js';

/* Types of the studio's HTTP API, shared by the server and the UI. No runtime code. */

/** Response of GET /api/catalogs. */
export interface Snapshot {
	localesDir: string;
	fallbackLocale: string;
	locales: string[];
	/** texts as they are in the code (locales/_t0n.json) */
	source: Catalog;
	translations: Record<string, Catalog>;
}
