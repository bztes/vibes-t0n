<script lang="ts">
	import { getStudio } from './studio.svelte.js';

	const studio = getStudio();
	const pct = (locale: string) => Math.round((studio.progress[locale] ?? 1) * 100);

	let trigger: HTMLButtonElement;
	let menu: HTMLDivElement;
	let dialog: HTMLDialogElement;
	let newLocale = $state('');
	let adding = $state(false);
	let error = $state('');

	/** Places the menu under its button, right-aligned with it; the popover itself handles outside clicks and Escape. */
	function place(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		const rect = trigger.getBoundingClientRect();
		menu.style.top = `${rect.bottom + 4}px`;
		menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
		menu.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
	}

	function pick(locale: string) {
		studio.select(locale);
		menu.hidePopover();
	}

	function openDialog() {
		menu.hidePopover();
		newLocale = '';
		error = '';
		dialog.showModal();
	}

	async function add(event: SubmitEvent) {
		event.preventDefault();
		const locale = newLocale.trim();
		if (!locale || adding) return;
		adding = true;
		error = '';
		try {
			await studio.addLocale(locale);
			dialog.close();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			adding = false;
		}
	}
</script>

<header>
	<h1>t0n <span>studio</span></h1>

	<span class="spacer"></span>
	<span class={['status', studio.status.error && 'error']}>{studio.status.text}</span>

	<input type="search" placeholder="Search texts, translations, files…" bind:value={studio.query} />
	<label class="toggle">
		<input type="checkbox" bind:checked={studio.missingOnly} />
		Missing only
	</label>

	<button
		class="trigger"
		bind:this={trigger}
		popovertarget="locale-menu"
		aria-haspopup="menu"
		title="Language to translate"
	>
		{#if studio.locale}
			<strong>{studio.locale}</strong>
			<span class="bar"><i style:width="{pct(studio.locale)}%"></i></span>
			<small>{pct(studio.locale)}%</small>
		{:else}
			Language
		{/if}
		<span class="caret" aria-hidden="true">▾</span>
	</button>

	<div id="locale-menu" class="menu" role="menu" popover bind:this={menu} ontoggle={place}>
		{#each studio.data?.locales ?? [] as locale (locale)}
			<button
				role="menuitemradio"
				aria-checked={locale === studio.locale}
				onclick={() => pick(locale)}
			>
				<span class="check" aria-hidden="true">{locale === studio.locale ? '✓' : ''}</span>
				<span class="name">
					{locale}
					{#if locale === studio.data?.fallbackLocale}<small>fallback</small>{/if}
				</span>
				<span class="bar"><i style:width="{pct(locale)}%"></i></span>
				<small class="pct">{pct(locale)}%</small>
			</button>
		{/each}
		<hr />
		<button role="menuitem" onclick={openDialog}>
			<span class="check" aria-hidden="true">+</span>
			<span class="name">Add language…</span>
		</button>
	</div>
</header>

<dialog bind:this={dialog} aria-labelledby="add-locale-title" closedby="any">
	<form onsubmit={add}>
		<h2 id="add-locale-title">Add language</h2>
		<label>
			Locale code
			<!-- svelte-ignore a11y_autofocus -->
			<input type="text" placeholder="e.g. fr or pt-BR" bind:value={newLocale} autofocus required />
		</label>
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		<p>Creates an empty catalog in {studio.data?.localesDir ?? 'the locales folder'}.</p>
		<div class="actions">
			<button type="button" onclick={() => dialog.close()}>Cancel</button>
			<button class="primary" disabled={adding || !newLocale.trim()}>
				{adding ? 'Adding…' : 'Add'}
			</button>
		</div>
	</form>
</dialog>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		min-height: var(--toolbar-height);
		padding: 10px 16px;
		background: var(--panel);
		border-bottom: 1px solid var(--line);
	}

	h1 {
		margin: 0;
		font-size: 15px;
		letter-spacing: 0.02em;

		span {
			color: var(--muted);
			font-weight: 400;
		}
	}

	input[type='search'] {
		width: min(280px, 100%);
	}

	.toggle {
		display: flex;
		gap: 6px;
		align-items: center;
		color: var(--muted);
		cursor: pointer;
	}

	.trigger {
		display: flex;
		gap: 8px;
		align-items: center;

		small {
			color: var(--muted);
			font-variant-numeric: tabular-nums;
		}
	}

	.caret {
		color: var(--muted);
		font-size: 11px;
	}

	.menu {
		position: fixed;
		inset: auto;
		margin: 0;
		min-width: 220px;
		max-height: 60vh;
		overflow: auto;
		padding: 4px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--panel);
		color: var(--text);
		box-shadow: 0 6px 24px rgb(0 0 0 / 0.15);

		button {
			display: grid;
			grid-template-columns: 16px 1fr auto 34px;
			gap: 8px;
			align-items: center;
			width: 100%;
			padding: 5px 8px;
			border: 0;
			border-radius: 5px;
			background: none;
			text-align: left;

			&:hover,
			&:focus-visible {
				background: var(--code);
				outline: none;
			}
		}

		hr {
			margin: 4px 0;
			border: 0;
			border-top: 1px solid var(--line);
		}
	}

	.check {
		color: var(--accent);
		text-align: center;
	}

	.name small,
	.pct {
		color: var(--muted);
		font-size: 12px;
	}

	.name small {
		margin-left: 4px;
	}

	.pct {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.bar {
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: var(--line);
		overflow: hidden;

		i {
			display: block;
			height: 100%;
			background: var(--ok);
		}
	}

	dialog {
		width: min(360px, calc(100vw - 32px));
		padding: 18px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--panel);
		color: var(--text);
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.2);

		&::backdrop {
			background: rgb(0 0 0 / 0.3);
		}

		h2 {
			margin: 0 0 12px;
			font-size: 15px;
		}

		label {
			display: grid;
			gap: 4px;
			font-size: 12px;
			color: var(--muted);
		}

		input {
			font-size: 14px;
			color: var(--text);
		}

		p {
			margin: 10px 0 0;
			font-size: 12px;
			color: var(--muted);
		}
	}

	dialog p.error {
		color: var(--error);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 16px;
	}

	.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #fff;

		&:disabled {
			opacity: 0.5;
			cursor: default;
		}
	}

	.spacer {
		flex: 1;
	}

	.status {
		min-width: 80px;
		color: var(--muted);
		font-size: 12px;
		text-align: right;

		&.error {
			color: var(--error);
		}
	}
</style>
