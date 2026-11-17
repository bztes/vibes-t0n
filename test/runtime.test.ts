import { describe, expect, it } from 'vitest';
import { fallbackLocale, isLocale, localeNames, locales, negotiateLocale } from '../src/config.js';
import { __t, getLocale, t, type FileMessages } from '../src/index.js';

// The locales come from the stub of virtual:t0n-config in vitest.config.ts.

describe('config', () => {
	it('reads the locales from the plugin config', () => {
		expect(fallbackLocale).toBe('en');
		expect(locales).toEqual(['en', 'de', 'fr']);
		expect(localeNames).toEqual({ en: 'English', de: 'Deutsch', fr: 'Français' });
	});

	it('checks for supported locales', () => {
		expect(isLocale('de')).toBe(true);
		expect(isLocale('es')).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});

describe('negotiateLocale', () => {
	it('prefers a supported cookie', () => {
		expect(negotiateLocale('fr', 'de')).toBe('fr');
		expect(negotiateLocale('es', 'de')).toBe('de');
	});

	it('picks the supported language with the highest quality', () => {
		expect(negotiateLocale(null, 'es;q=1, fr;q=0.5, de-CH;q=0.8')).toBe('de');
		expect(negotiateLocale(null, 'FR-ca')).toBe('fr');
	});

	it('falls back without a supported language', () => {
		expect(negotiateLocale(undefined, 'es, it')).toBe('en');
		expect(negotiateLocale(undefined, undefined)).toBe('en');
		expect(negotiateLocale(undefined, '')).toBe('en');
	});
});

describe('t without the plugin', () => {
	it('returns the text with the values filled in', () => {
		const count = 3;
		expect(t`${count} trees and ${'a'} ${null}`).toBe('3 trees and a null');
	});
});

describe('__t', () => {
	// Outside a browser and without a server hook, the locale is the fallback locale.
	const file: FileMessages = {
		messages: { en: { k1: 'Hi {name}, {1} new', k2: '' } }
	};

	it('uses the fallback locale outside a browser', () => {
		expect(getLocale()).toBe('en');
	});

	it('looks up the translation and fills in the values', () => {
		expect(__t(file, 'k1', 'Hello {name}, {1} new', { name: 'Ada', 1: 2 })).toBe('Hi Ada, 2 new');
	});

	it('uses the text from the code for missing and empty translations', () => {
		expect(__t(file, 'k2', 'Bye')).toBe('Bye');
		expect(__t(file, 'missing', 'Hello {name}', { name: 'Ada' })).toBe('Hello Ada');
		expect(__t({ messages: {} }, 'k1', 'Hello')).toBe('Hello');
	});

	it('keeps placeholders without a value', () => {
		expect(__t(file, 'k1', '', { name: 'Ada' })).toBe('Hi Ada, {1} new');
	});
});
