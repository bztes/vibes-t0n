#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { studio } from './studio/server.js';

const help = `Usage: t0n studio [options]

Opens a web UI to edit the translations in the locales directory.

Options:
  --locales <dir>    directory with the <locale>.json catalogs (default: locales)
  --fallback <code>  fallback locale, as in the vite plugin (default: en)
  --port <number>    (default: 4983)
  --host <host>      (default: 127.0.0.1)
  --open             open the browser
  -h, --help`;

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		// no defaults here: `studio()` applies them
		locales: { type: 'string' },
		fallback: { type: 'string' },
		port: { type: 'string' },
		host: { type: 'string' },
		open: { type: 'boolean', default: false },
		help: { type: 'boolean', short: 'h', default: false }
	}
});

if (values.help || positionals[0] !== 'studio') {
	console.log(help);
	process.exit(values.help ? 0 : 1);
}

const { url } = await studio({
	localesDir: values.locales,
	fallbackLocale: values.fallback,
	port: values.port === undefined ? undefined : Number(values.port),
	host: values.host
});
console.log(`t0n studio is running on ${url}`);

if (values.open) {
	const command =
		process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
	spawn(command, [url], { stdio: 'ignore', detached: true }).unref();
}
