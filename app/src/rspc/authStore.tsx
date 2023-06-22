import { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { proxy, subscribe, useSnapshot } from 'valtio';
import { useBridgeQuery, useUserQuery } from '.';
import { SpaceWrapped, User, UserWithToken } from './core';

export function persistKey<T extends object>(localStorageKey: string, initialObject?: T): T {
	const d = localStorage.getItem(localStorageKey);
	const p = proxy(d !== null ? JSON.parse(d) : initialObject);
	subscribe(p, () => localStorage.setItem(localStorageKey, JSON.stringify(p)));
	return p;
}

export const authStore = persistKey('auth-26', {
	jwt: null as string | null
});

export const useAuth = () => {
	const { jwt } = useSnapshot(authStore);

	return jwt;
};
