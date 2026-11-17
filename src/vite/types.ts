import type MagicString from 'magic-string';

/** Minimal ESTree node, as produced by both oxc and the svelte compiler. */
export interface Node {
	type: string;
	start: number;
	end: number;
	[key: string]: unknown;
}

export interface TemplateLiteral extends Node {
	quasis: { value: { raw: string; cooked: string | null } }[];
	expressions: Node[];
}

export interface TaggedTemplate extends Node {
	tag: Node & { name?: string };
	quasi: TemplateLiteral;
}

/** Result of parsing one source file. */
export interface ParsedSource {
	/** every t`` in the file with offsets into the original code, sorted by start */
	nodes: TaggedTemplate[];
	/** adds `imports` (one line of import statements) where the file's code can see them */
	addImports(s: MagicString, imports: string): void;
}

/** A kind of source file the plugin can find t`` in, e.g. JS/TS, .svelte or .vue. */
export interface SourceLanguage {
	/** file extensions including the dot, e.g. ['.svelte'] */
	extensions: string[];
	/** Throws on syntax errors, which the plugin leaves to the regular compiler to report. */
	parse(code: string, id: string): ParsedSource;
}

/**
 * Everything framework specific. The core (catalogs, lookups, locale state) is shared; a
 * framework adds the file types it compiles and makes `getLocale()` reactive in its components.
 */
export interface Framework {
	name: string;
	/** source languages besides JS/TS/JSX/TSX, which are always supported */
	languages: SourceLanguage[];
	/**
	 * Absolute path of a browser module whose default export is a `ReactivityAdapter`
	 * (see `src/index.ts`). It is imported by the runtime through `virtual:t0n-reactivity`.
	 */
	reactivity: string;
}
