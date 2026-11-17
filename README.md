# @bztes/vibes-t0n

> [!WARNING]
> **A personal project.** I built this for my own apps, largely with an AI assistant. It's public
> mainly because that's convenient for me, so it isn't really intended for use by others: I can't
> offer support, and things may change or break without notice. For a production app, an
> established i18n library is probably the better choice.

Translate your Svelte app without inventing keys. Write your texts as they are, just wrap them in
`` t`...` ``:

```svelte
<script>
	import { t } from '@bztes/vibes-t0n';
	let { user, count } = $props();
</script>

<h1>{t`Hello ${user.name}`}</h1><p>{t`${count} trees`}</p>
```

t0n finds these texts, puts them into one file per language, and shows the right translation to
each visitor. Anything not translated yet simply shows the original text.

## Install

```sh
pnpm add @bztes/vibes-t0n
```

Then follow the section for your framework. In every setup, your texts are written in English by
default; change that with `t0n({ fallbackLocale: 'de' })`.

## SvelteKit

Add the plugin before SvelteKit:

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { t0n } from '@bztes/vibes-t0n/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [t0n(), sveltekit()]
});
```

Add the hook, so every page is rendered in the visitor's language right away:

```ts
// src/hooks.server.ts
import { handleLocale } from '@bztes/vibes-t0n/sveltekit';

export const handle = handleLocale;
```

```html
<!-- src/app.html -->
<html lang="%lang%"></html>
```

Use `` t`...` `` in components and in server code like `load` functions or form actions:

```svelte
<!-- src/routes/+page.svelte -->
<script>
	import { t, locales, localeNames, getLocale, setLocale } from '@bztes/vibes-t0n';
	let { data } = $props();
</script>

<h1>{t`Welcome back, ${data.user.name}`}</h1>

<select value={getLocale()} onchange={(e) => setLocale(e.currentTarget.value)}>
	{#each locales as locale}
		<option value={locale}>{localeNames[locale]}</option>
	{/each}
</select>
```

```ts
// src/routes/+page.server.ts
import { fail } from '@sveltejs/kit';
import { t } from '@bztes/vibes-t0n';

export const actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		if (!form.get('email')) return fail(400, { error: t`Please enter your email address` });
	}
};
```

The language is picked from the visitor's earlier choice, then from their browser settings.

## Svelte

For a Svelte app without SvelteKit, add the plugin before Svelte:

```ts
// vite.config.ts
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { t0n } from '@bztes/vibes-t0n/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [t0n(), svelte()]
});
```

Leave the `lang` attribute out of `index.html`, so t0n can pick the visitor's language:

```html
<!-- index.html -->
<html>
	…
</html>
```

```svelte
<!-- src/App.svelte -->
<script>
	import { t, locales, localeNames, getLocale, setLocale } from '@bztes/vibes-t0n';
	let count = $state(0);
</script>

<button onclick={() => count++}>{t`Clicked ${count} times`}</button>

<select value={getLocale()} onchange={(e) => setLocale(e.currentTarget.value)}>
	{#each locales as locale}
		<option value={locale}>{localeNames[locale]}</option>
	{/each}
</select>
```

Everything that shows a text updates by itself when the language changes.

## Plain JavaScript / TypeScript

No framework needed. Tell the plugin:

```ts
// vite.config.ts
import { t0n } from '@bztes/vibes-t0n/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [t0n({ framework: 'vanilla' })]
});
```

As with Svelte, leave the `lang` attribute out of `index.html`. Since nothing re-renders on its
own, redraw your texts with `onLocaleChange`:

```ts
// src/main.ts
import { t, locales, localeNames, getLocale, setLocale, onLocaleChange } from '@bztes/vibes-t0n';

const title = document.querySelector('h1')!;
const picker = document.querySelector('select')!;

picker.append(...locales.map((locale) => new Option(localeNames[locale], locale)));
picker.addEventListener('change', () => setLocale(picker.value));

function render() {
	title.textContent = t`Hello world`;
	picker.value = getLocale();
}

render();
onLocaleChange(render);
```

## Other frameworks

Vue, React and others are not supported, simply because I don't use them myself. t0n is built so
that other frameworks can be added without changing how it is used, so if you'd like to use it
with your framework, [open an issue](https://github.com/bztes/vibes-t0n/issues) and it can be done.

## Adding a language

Create an empty file for it, e.g. `locales/fr.json`. t0n fills it with every text of your app,
ready to translate:

```json
{
	"lib/components/Header.svelte": {
		"awzJBNCB": "",
		"RtzIjlts": ""
	}
}
```

The keys are generated, you don't need to read them. The easiest way to translate is the studio.

## Studio

Translate in your browser instead of editing JSON:

```sh
pnpm t0n studio --open
```

You see every text next to its translations, what is still missing, and warnings when a
translation forgets a value like `{user.name}`. Changes are saved right away and show up in your
running app immediately.

## Good to know

- Use `` t`...` `` while rendering, not in a value that is computed only once, so it can follow
  language switches.
- Visitors only download the translations for their own language.
- `locales/_t0n.json` lists all texts as they are in your code. It is not a language.

## Reference

| Import from                  | What                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| `@bztes/vibes-t0n`           | `t`, `getLocale`, `setLocale`, `locales`, `localeNames`, `onLocaleChange` |
| `@bztes/vibes-t0n/vite`      | `t0n(options)`, the Vite plugin                                           |
| `@bztes/vibes-t0n/sveltekit` | `handleLocale`, `detectLocale`                                            |
| `@bztes/vibes-t0n/server`    | `negotiateLocale`, for other server frameworks                            |

Plugin options:

| Option           | Default     | Meaning                                |
| ---------------- | ----------- | -------------------------------------- |
| `fallbackLocale` | `'en'`      | The language your texts are written in |
| `framework`      | `'svelte'`  | `'svelte'` or `'vanilla'`              |
| `srcDir`         | `'src'`     | Where your code is                     |
| `localesDir`     | `'locales'` | Where the language files are           |

Studio options: `--locales <dir>`, `--fallback <language>`, `--port <number>`, `--open`.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up the
project.
