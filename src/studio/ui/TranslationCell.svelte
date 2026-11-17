<script lang="ts">
	import { placeholderPattern } from '../../format.js';
	import { getStudio } from './studio.svelte.js';

	let { file, textKey, source }: { file: string; textKey: string; source: string } = $props();
	const studio = getStudio();
	const locale = $derived(studio.locale);

	const value = $derived(studio.value(locale, file, textKey));
	const missing = $derived(studio.isMissing(locale, file, textKey));
	const cell = $derived(studio.cellState(locale, file, textKey));
	// for the fallback locale itself this is its own value, which only shows when empty
	const hint = $derived(studio.value(studio.data?.fallbackLocale ?? '', file, textKey) || source);

	const placeholders = (text: string) => new Set(text.match(placeholderPattern) ?? []);

	/** Placeholders of the code that the translation lost, or that it made up. */
	const problems = $derived.by(() => {
		const expected = placeholders(source);
		const got = placeholders(value);
		const lost = [...expected].filter((p) => !got.has(p));
		const unknown = [...got].filter((p) => !expected.has(p));
		return [
			value && lost.length ? `missing ${lost.join(', ')}` : '',
			unknown.length ? `unknown ${unknown.join(', ')}` : ''
		]
			.filter(Boolean)
			.join(' · ');
	});

	/** Enter jumps to the same language in the next row (Alt+Enter: previous), Shift+Enter adds a line break. */
	function onkeydown(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		const all = [...document.querySelectorAll<HTMLTextAreaElement>('textarea')].filter(
			(area) => area.lang === locale
		);
		const next = all[all.indexOf(event.currentTarget) + (event.altKey ? -1 : 1)];
		next?.focus();
		next?.select();
	}
</script>

<td class={{ missing, saving: cell.saving, failed: cell.failed }}>
	<textarea
		rows="1"
		lang={locale}
		placeholder={hint}
		{value}
		oninput={(e) => studio.edit(locale, file, textKey, e.currentTarget.value)}
		{onkeydown}></textarea>
	{#if problems}<div class="warn">{problems}</div>{/if}
</td>

<style>
	td {
		padding: 0;
		vertical-align: top;
		border-left: 1px solid var(--line);
	}

	textarea {
		display: block;
		width: 100%;
		min-height: 30px;
		padding: 5px 10px;
		resize: none;
		border: 0;
		border-radius: 0;
		background: transparent;
		field-sizing: content;

		&:focus {
			outline: 2px solid var(--accent);
			outline-offset: -2px;
			background: var(--panel);
		}

		&::placeholder {
			color: var(--muted);
			opacity: 0.6;
		}
	}

	.missing textarea {
		background: var(--missing-bg);
		box-shadow: inset 3px 0 var(--missing);
	}

	.saving textarea {
		color: var(--muted);
	}

	.failed textarea {
		box-shadow: inset 0 0 0 1px var(--error);
	}

	.warn {
		padding: 0 10px 4px;
		color: var(--error);
		font-size: 11px;
	}
</style>
