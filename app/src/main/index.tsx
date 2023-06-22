import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from 'react-error-boundary';
import { Outlet, RouteObject, RouterProvider, RouterProviderProps } from 'react-router-dom';
import styled from 'styled-components/macro';
import { useSnapshot } from 'valtio';
// @ts-ignore
import Bg from '~/assets/bg';
import { useInvalidateQuery } from '~/rspc';
import { Modals, ThemeProvider, ThemedGlobalStyle } from '~/ui';
import { persistKey } from '../rspc/useAppContent';
import ErrorFallback, { RouterErrorBoundary } from '../util/ErrorFallback';
import topRoutes from './top';

const BG = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	// should stretch to fill the screen
	background: linear-gradient(0deg, rgba(254, 254, 249, 0.97), rgba(254, 254, 249, 0.98)),
		url(${Bg}) center center repeat;
	mix-blend-mode: normal;
	box-shadow: 0px 12px 36px rgba(0, 0, 0, 0.1), inset 0px 4px 4px rgba(0, 0, 0, 0.25);
	z-index: -1;
`;

const Wrapper = () => {
	useInvalidateQuery();

	console.log('rendering wrapper');

	return (
		<>
			<Outlet />
			<BG />
		</>
	);
};

export const appRoutes = [
	{
		element: <Wrapper />,
		errorElement: <RouterErrorBoundary />,
		children: topRoutes
	}
] satisfies RouteObject[];

interface DebugState {
	enabled: boolean;
	rspcLogger: boolean;
	reactQueryDevtools: 'enabled' | 'disabled' | 'invisible';
	shareTelemetry: boolean; // used for sending telemetry even if the app is in debug mode, and ONLY if client settings also allow telemetry sharing
	telemetryLogging: boolean;
}

export const debugState: DebugState = persistKey('debug', {
	enabled: globalThis.isDev,
	rspcLogger: false,
	reactQueryDevtools: globalThis.isDev ? 'invisible' : 'enabled',
	shareTelemetry: false,
	telemetryLogging: false
});

export function useDebugState() {
	return useSnapshot(debugState);
}

export function getDebugState() {
	return debugState;
}

const Devtools = () => {
	const debugState = useDebugState();

	// The `context={defaultContext}` part is required for this to work on Windows.
	// Why, idk, don't question it
	return debugState.reactQueryDevtools !== 'disabled' ? (
		<ReactQueryDevtools
			panelProps={{
				style: {
					fontSize: '0.5rem'
				}
			}}
			position="bottom-right"
			toggleButtonProps={{
				tabIndex: -1,
				className: debugState.reactQueryDevtools === 'invisible' ? 'opacity-0' : ''
			}}
		/>
	) : null;
};

export const YerbInterface = (props: { router: RouterProviderProps['router'] }) => {
	return (
		<ErrorBoundary FallbackComponent={ErrorFallback}>
			<Devtools />
			{/* <SpacedropUI /> */}
			<ThemeProvider>
				<ThemedGlobalStyle />
				<RouterProvider router={props.router} />
				<Modals />
			</ThemeProvider>
		</ErrorBoundary>
	);
};
