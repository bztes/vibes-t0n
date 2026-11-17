<script lang="ts">
	import SourceText from './SourceText.svelte';
	import TranslationCell from './TranslationCell.svelte';
	import type { Row } from './studio.svelte.js';

	let { file, rows }: { file: string; rows: Row[] } = $props();
</script>

<tbody>
	<tr id={encodeURIComponent(file)}>
		<th colspan="2" scope="rowgroup">{file} <span>{rows.length}</span></th>
	</tr>
	{#each rows as { key, source } (key)}
		<tr>
			<td class="source"><SourceText text={source} /><span class="key">{key}</span></td>
			<TranslationCell {file} textKey={key} {source} />
		</tr>
	{/each}
</tbody>

<style>
	tr {
		scroll-margin-top: calc(var(--toolbar-height) + var(--thead-height) + 26px);

		&:hover :global(td) {
			background: color-mix(in srgb, var(--code) 50%, transparent);
		}

		&:hover .key {
			visibility: visible;
		}
	}

	/* sticks under the column header until the next file's row pushes it away */
	th {
		position: sticky;
		top: calc(var(--toolbar-height) + var(--thead-height));
		z-index: 1;
		padding: 4px 10px;
		text-align: left;
		font:
			600 12px ui-monospace,
			monospace;
		background: var(--code);
		border-bottom: 1px solid var(--line);

		span {
			margin-left: 6px;
			font-weight: 400;
			color: var(--muted);
		}
	}

	tr :global(td) {
		border-bottom: 1px solid var(--line);
	}

	.source {
		position: relative;
		padding: 5px 10px;
		vertical-align: top;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.key {
		position: absolute;
		top: 2px;
		right: 6px;
		visibility: hidden;
		color: var(--muted);
		font:
			10px ui-monospace,
			monospace;
	}
</style>
