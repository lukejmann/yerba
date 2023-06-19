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

export interface AppContext {
	jwt: string | null;
	currentSpaceId: string | null;
	spaces: ReturnType<typeof useCachedSpaces>;
	space: SpaceWrapped | null | undefined;
}

export const useCachedSpaces = () => useUserQuery(['spaces.list'], {});

const AppContext = createContext<AppContext>(null!);

interface AppContextProviderProps extends PropsWithChildren {
	currentSpaceId: string | null;
}

export const AppContextProvider = ({ children, currentSpaceId }: AppContextProviderProps) => {
	const spaces = useCachedSpaces();
	const { jwt } = useSnapshot(authStore);

	console.log('jwt', jwt);

	const space = useMemo(() => {
		if (spaces.data) return spaces.data.find((l) => l.id === currentSpaceId) ?? null;
	}, [currentSpaceId, spaces]);

	currentSpaceCache.id = currentSpaceId;

	return (
		<AppContext.Provider value={{ currentSpaceId, spaces, space, jwt }}>
			{children}
		</AppContext.Provider>
	);
};

export const useAppContext = () => {
	const ctx = useContext(AppContext);

	if (ctx === undefined) throw new Error("'AppContextProvider' not mounted");

	return ctx;
};

export const useCurrentSpaceId = () => useAppContext().currentSpaceId;

export const currentSpaceCache = persistKey('livespace', {
	id: null as string | null
});

export const useAuth = () => {
	const { jwt } = useSnapshot(authStore);

	return jwt;
};

export const useSetAuth = () => {
	return (jwt: string | null) => {
		authStore.jwt = jwt;
		console.log('authStore.jwt', authStore.jwt);
	};
};
