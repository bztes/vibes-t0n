<script lang="ts">
	/** A text with its {placeholders} highlighted. */
	import { placeholderPattern } from '../../format.js';

	let { text }: { text: string } = $props();

	// placeholders at the odd indexes; split only yields their names
	const parts = $derived(
		text.split(placeholderPattern).map((part, i) => (i % 2 ? `{${part}}` : part))
	);
</script>

{#each parts as part, i (i)}{#if i % 2}<span class="ph">{part}</span>{:else}{part}{/if}{/each}

<style>
	.ph {
		padding: 0 3px;
		border-radius: 3px;
		background: var(--code);
		font-family: ui-monospace, monospace;
		font-size: 12.5px;
	}
</style>
