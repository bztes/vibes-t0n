declare module 'virtual:t0n-config' {
	export const fallbackLocale: string;
	export const locales: readonly string[];
}

declare module 'virtual:t0n-reactivity' {
	const reactivity: import('./index.js').ReactivityAdapter;
	export default reactivity;
}
