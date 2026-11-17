<script lang="ts">
	import FileNav from './FileNav.svelte';
	import FileSection from './FileSection.svelte';
	import Toolbar from './Toolbar.svelte';
	import { Studio, setStudio } from './studio.svelte.js';

	const studio = setStudio(new Studio());

	$effect(() => {
		void studio.load();
		return studio.listen();
	});
</script>

<Toolbar />

<div class="layout">
	<FileNav />
	<main>
		{#if !studio.data}
			<p class="empty">Loading…</p>
		{:else if !studio.files.length}
			<p class="empty">
				No texts in {studio.data.localesDir}/_t0n.json yet. Start the vite dev server or build once,
				so the plugin collects the t`…` texts.
			</p>
		{:else if !studio.visible.length}
			<p class="empty">Nothing matches.</p>
		{:else}
			<table>
				<colgroup><col /><col /></colgroup>
				<thead>
					<tr>
						<th>Code</th>
						<th>
							{studio.locale}
							{#if studio.locale === studio.data.fallbackLocale}<small>fallback</small>{/if}
						</th>
					</tr>
				</thead>
				{#each studio.visible as { file, rows } (file)}
					<FileSection {file} {rows} />
				{/each}
			</table>
		{/if}
	</main>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: 240px 1fr;
		min-height: calc(100vh - var(--toolbar-height));
	}

	main {
		min-width: 0;
		background: var(--panel);
	}

	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
	}

	th {
		position: sticky;
		top: var(--toolbar-height);
		z-index: 2;
		height: var(--thead-height);
		padding: 0 10px;
		text-align: left;
		font-weight: 500;
		font-size: 12px;
		color: var(--muted);
		background: var(--panel);
		border-bottom: 1px solid var(--line);

		& + th {
			border-left: 1px solid var(--line);
		}

		small {
			margin-left: 4px;
			font-weight: 400;
		}
	}

	.empty {
		padding: 40px;
		text-align: center;
		color: var(--muted);
	}

	@media (max-width: 800px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
