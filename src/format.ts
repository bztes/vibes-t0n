/*
 * The catalog format, shared by the plugin, the runtime and the studio UI. No dependencies, so the
 * browser bundles can import it.
 */

/** source file (relative to src/) → hash of the source text → translation */
export type Catalog = Record<string, Record<string, string>>;

/** A placeholder in a text, e.g. `{user.name}`; the group is the name. Global, for replace/match. */
export const placeholderPattern = /\{([^{}]+)\}/g;

/** Defaults shared by the vite plugin and the studio. */
export const defaultFallbackLocale = 'en';
export const defaultLocalesDir = 'locales';
