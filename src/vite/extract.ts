import { createHash } from 'node:crypto';
import type { Node, TaggedTemplate } from './types.js';

/*
 * Framework independent part of the transform: finding t`...` in an AST, turning it into a
 * message with named placeholders and rewriting it into a lookup:
 *
 *   t`Hello ${user.name}`  →  __t(__i18n, "<hash>", "Hello {user.name}", { "user.name": user.name })
 */

function isT(node: Node): node is TaggedTemplate {
	return (
		node.type === 'TaggedTemplateExpression' &&
		(node as TaggedTemplate).tag.type === 'Identifier' &&
		(node as TaggedTemplate).tag.name === 't'
	);
}

/**
 * Every t`` in an ESTree-like AST, sorted by position. Walks any object graph, so it also works
 * for framework ASTs that embed ESTree expressions (like svelte's). Nodes matching `skip` are not entered.
 */
export function collect(root: unknown, skip: (node: Node) => boolean = () => false) {
	const found: TaggedTemplate[] = [];
	const seen = new Set<unknown>();
	(function walk(value: unknown) {
		if (!value || typeof value !== 'object' || seen.has(value)) return;
		seen.add(value);
		if (Array.isArray(value)) return value.forEach(walk);
		const node = value as Node;
		if (skip(node)) return;
		if (isT(node)) found.push(node);
		for (const key in node) if (key !== 'parent' && key !== 'metadata') walk(node[key]);
	})(root);
	return found.sort((a, b) => a.start - b.start);
}

const plainAccess = /^[A-Za-z_$][\w$]*(\??\.[A-Za-z_$][\w$]*)*$/;

function placeholder(code: string, expression: Node, index: number) {
	const source = code.slice(expression.start, expression.end).trim();
	return plainAccess.test(source) ? source.replaceAll('?.', '.') : String(index);
}

/** Key of a text in the catalogs, unique within its source file. */
export function hash(message: string) {
	return createHash('sha256').update(message).digest('base64url').slice(0, 8);
}

/** Text of a t`` as stored in the catalogs, e.g. "Hello {user.name}". */
export function message(code: string, node: TaggedTemplate) {
	const { quasis, expressions } = node.quasi;
	return quasis
		.map((q, i) => {
			const text = q.value.cooked ?? q.value.raw;
			return i < expressions.length ? `${text}{${placeholder(code, expressions[i], i)}}` : text;
		})
		.join('');
}

/** The t`` within code[start, end) that are not nested in another one, from sorted `nodes`. */
export function outermost(nodes: TaggedTemplate[], start = 0, end = Infinity) {
	const result: TaggedTemplate[] = [];
	let pos = start;
	for (const node of nodes) {
		if (node.start < pos || node.end > end) continue;
		result.push(node);
		pos = node.end;
	}
	return result;
}

/** Source of code[start, end) with every outermost t`` inside replaced by its lookup. */
function rewrite(code: string, nodes: TaggedTemplate[], start: number, end: number): string {
	let out = '';
	let pos = start;
	for (const node of outermost(nodes, start, end)) {
		out += code.slice(pos, node.start) + lookup(code, nodes, node);
		pos = node.end;
	}
	return out + code.slice(pos, end);
}

/** Lookup replacing `node`, with t`` nested in its expressions rewritten too. */
export function lookup(code: string, nodes: TaggedTemplate[], node: TaggedTemplate) {
	const values = node.quasi.expressions.map(
		(e, i) =>
			`${JSON.stringify(placeholder(code, e, i))}: (${rewrite(code, nodes, e.start, e.end)})`
	);
	const text = message(code, node);
	const args = [
		JSON.stringify(hash(text)),
		JSON.stringify(text),
		...(values.length ? [`{ ${values.join(', ')} }`] : [])
	];
	return `__t(__i18n, ${args.join(', ')})`;
}
