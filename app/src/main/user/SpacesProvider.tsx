import { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { SpaceWrapped, authStore, persistKey, useAuth, useUserQuery } from '~/rspc';

export interface SpacesContext {
	currentSpaceId: string | null;
	spaces: ReturnType<typeof useCachedSpaces>;
	space: SpaceWrapped | null | undefined;
}

export const useCachedSpaces = () => useUserQuery(['spaces.list'], {});

const SpacesContext = createContext<SpacesContext>(null!);

interface SpacesContextProviderProps extends PropsWithChildren {
	currentSpaceId: string | null;
}

export const SpacesContextProvider = ({ children, currentSpaceId }: SpacesContextProviderProps) => {
	const jwt = useAuth();
	const spaces = useCachedSpaces();

	const space = useMemo(() => {
		if (spaces.data) return spaces.data.find((l) => l.id === currentSpaceId) ?? null;
	}, [currentSpaceId, spaces]);

	currentSpaceCache.id = currentSpaceId;

	return (
		<SpacesContext.Provider value={{ currentSpaceId, spaces, space }}>
			{children}
		</SpacesContext.Provider>
	);
};

export const useSpacesContext = () => {
	const ctx = useContext(SpacesContext);

	if (ctx === undefined) throw new Error("'SpacesContextProvider' not mounted");

	return ctx;
};

export const useCurrentSpaceId = () => useSpacesContext().currentSpaceId;

export const currentSpaceCache = persistKey('livespace', {
	id: null as string | null
});
