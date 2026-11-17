import { createSubscriber } from 'svelte/reactivity';
import type { ReactivityAdapter } from '../../index.js';

// Re-renders everything that read the locale once it changes, without needing runes.
const reactivity: ReactivityAdapter = (subscribe) => createSubscriber(subscribe);

export default reactivity;
