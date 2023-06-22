import { Link } from '@rspc/client/v2';

declare global {
	// eslint-disable-next-line
	var isDev: boolean;
	// eslint-disable-next-line
	var rspcLinks: Link[];
}

if (
	globalThis.localStorage === undefined ||
	globalThis.isDev === undefined ||
	globalThis.rspcLinks === undefined
)
	throw new Error('Please ensure you have patched `globalThis` before importing `~/rspc`!');

export * from './rspc';
export * from './core';
export * from './authStore';
