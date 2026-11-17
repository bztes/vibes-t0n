<script lang="ts">
	import { getStudio } from './studio.svelte.js';

	const studio = getStudio();
</script>

<nav>
	{#each studio.files as { file } (file)}
		{@const missing = studio.missingByFile[file]}
		<a href="#{encodeURIComponent(file)}">
			<span>{file}</span>
			{#if missing}<span class="count" title="texts with missing translations">{missing}</span>{/if}
		</a>
	{/each}
</nav>

<style>
	nav {
		position: sticky;
		top: var(--toolbar-height);
		align-self: start;
		max-height: calc(100vh - var(--toolbar-height));
		overflow: auto;
		padding: 12px 8px;
		border-right: 1px solid var(--line);
	}

	a {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 4px 8px;
		border-radius: 5px;
		color: var(--text);
		text-decoration: none;
		font-size: 13px;
		word-break: break-all;

		&:hover {
			background: var(--code);
		}
	}

	.count {
		color: var(--missing);
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 800px) {
		nav {
			display: none;
		}
	}
</style>
