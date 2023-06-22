import { ProcedureDef } from '@rspc/client';
import { AlphaRSPCError, initRspc } from '@rspc/client/v2';
import { Context, createReactQueryHooks } from '@rspc/react/v2';
import { QueryClient } from '@tanstack/react-query';
import { PropsWithChildren, createContext, useContext } from 'react';
import { currentSpaceCache } from '~/main/user/SpacesProvider';
import { authStore } from './authStore';
import { Procedures, SpaceArgs, UserArgs } from './core';

type BaseProcedures<T extends keyof Procedures> =
	| Exclude<Procedures[T], { input: SpaceArgs<any> }>
	| Exclude<Procedures[T], { input: UserArgs<any> }>
	| Extract<Procedures[T], { input: never }>;

type SpaceProcedures<T extends keyof Procedures> = Exclude<
	Extract<Procedures[T], { input: SpaceArgs<any> }>,
	{ input: never }
>;

type UserProcedures<T extends keyof Procedures> = Exclude<
	Extract<Procedures[T], { input: UserArgs<any> }>,
	{ input: never }
>;

type StripSpaceArgsFromInput<T extends ProcedureDef, NeverOverNull extends boolean> = T extends any
	? T['input'] extends SpaceArgs<infer E>
		? {
				key: T['key'];
				input: NeverOverNull extends true ? (E extends null ? never : E) : E;
				result: T['result'];
		  }
		: never
	: never;

type StripUserArgsFromInput<T extends ProcedureDef, NeverOverNull extends boolean> = T extends any
	? T['input'] extends UserArgs<infer E>
		? {
				key: T['key'];
				input: NeverOverNull extends true ? (E extends null ? never : E) : E;
				result: T['result'];
		  }
		: never
	: never;

type BaseProceduresDef = {
	queries: BaseProcedures<'queries'>;
	mutations: BaseProcedures<'mutations'>;
	subscriptions: BaseProcedures<'subscriptions'>;
};

export type SpaceProceduresDef = {
	queries: StripSpaceArgsFromInput<SpaceProcedures<'queries'>, true>;
	mutations: StripSpaceArgsFromInput<SpaceProcedures<'mutations'>, false>;
	subscriptions: StripSpaceArgsFromInput<SpaceProcedures<'subscriptions'>, true>;
};

export type UserProceduresDef = {
	queries: StripUserArgsFromInput<UserProcedures<'queries'>, true>;
	mutations: StripUserArgsFromInput<UserProcedures<'mutations'>, false>;
	subscriptions: StripUserArgsFromInput<UserProcedures<'subscriptions'>, true>;
};

const spaceContext = createContext<Context<SpaceProceduresDef>>(undefined!);

const userContext = createContext<Context<UserProceduresDef>>(undefined!);

export const useRspcSpaceContext = () => useContext(spaceContext);

export const useRspcUserContext = () => useContext(userContext);

export const rspc = initRspc<Procedures>({
	links: globalThis.rspcLinks
});
export const rspc2 = initRspc<Procedures>({
	links: globalThis.rspcLinks
}); // TODO: Removing this?
export const rspc3 = initRspc<Procedures>({
	links: globalThis.rspcLinks
});

const baseClient = rspc.dangerouslyHookIntoInternals<BaseProceduresDef>();
// @ts-expect-error // TODO: Fix
const baseHooks = createReactQueryHooks<BaseProceduresDef>(baseClient, {
	// context // TODO: Shared context
});

// random uuid as a bandaid for missing spaceId now
const FAKE_UUID = 'e94e5521-e182-4f32-9888-016a6eb9aa85';

const spaceClient = rspc2.dangerouslyHookIntoInternals<SpaceProceduresDef>({
	mapQueryKey: (keyAndInput) => {
		const jwt = authStore.jwt;
		// console.log('jwt in userClient', jwt);
		// console.log('space_id', currentSpaceCache.id);
		if (!jwt) {
			console.error('Attempted to do space operation with no user set!');
			return [
				keyAndInput[0],
				{ jwt_token: 'null_jwt', space_id: FAKE_UUID, arg: keyAndInput[1] ?? null }
			];
		}

		const spaceId = currentSpaceCache.id;
		if (spaceId === null) {
			console.error('Attempted to do space operation with no space set!');
			return [keyAndInput[0], { jwt_token: jwt, space_id: FAKE_UUID, arg: keyAndInput[1] ?? null }];
		}
		return [keyAndInput[0], { jwt_token: jwt, space_id: spaceId, arg: keyAndInput[1] ?? null }];
	}
});
// @ts-expect-error
const spaceHooks = createReactQueryHooks<SpaceProceduresDef>(spaceClient, {
	context: spaceContext
});

const userClient = rspc3.dangerouslyHookIntoInternals<UserProceduresDef>({
	mapQueryKey: (keyAndInput) => {
		const jwt = authStore.jwt;
		if (!jwt) {
			console.error('Attempted to do user operation with no user set!');
			return [keyAndInput[0], { jwt_token: 'null_jwt', arg: keyAndInput[1] ?? null }];
		}
		return [keyAndInput[0], { jwt_token: jwt, arg: keyAndInput[1] ?? null }];
	}
});

// @ts-expect-error
const userHooks = createReactQueryHooks<UserProceduresDef>(userClient, {
	context: userContext
});

export function RspcProvider({
	queryClient,
	children
}: PropsWithChildren<{ queryClient: QueryClient }>) {
	return (
		<userHooks.Provider client={userClient as any} queryClient={queryClient}>
			<spaceHooks.Provider client={spaceClient as any} queryClient={queryClient}>
				<baseHooks.Provider client={baseClient as any} queryClient={queryClient}>
					{children as any}
				</baseHooks.Provider>
			</spaceHooks.Provider>
		</userHooks.Provider>
	);
}

export const useBridgeQuery = baseHooks.useQuery;
export const useBridgeMutation = baseHooks.useMutation;
export const useBridgeSubscription = baseHooks.useSubscription;
export const useSpaceQuery = spaceHooks.useQuery;
export const useSpaceMutation = spaceHooks.useMutation;
export const useSpaceSubscription = spaceHooks.useSubscription;
export const useUserQuery = userHooks.useQuery;
export const useUserMutation = userHooks.useMutation;
export const useUserSubscription = userHooks.useSubscription;

export function useInvalidateQuery() {
	const context = baseHooks.useContext();
	useBridgeSubscription(['invalidation.listen'], {
		onData: (ops) => {
			for (const op of ops) {
				let key = [op.key];
				if (op.arg !== null) {
					key = key.concat(op.arg);
				}

				console.log('Invalidating', key);

				if (op.result !== null) {
					context.queryClient.setQueryData(key, op.result);
				} else {
					context.queryClient.invalidateQueries(key);
				}
			}
		}
	});
}

// TODO: Remove/fix this when rspc typesafe errors are working
export function extractInfoRSPCError(error: unknown) {
	if (!(error instanceof AlphaRSPCError)) return null;
	return error;
}
