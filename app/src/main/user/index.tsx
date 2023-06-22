import { Outlet, RouteObject } from 'react-router-dom';
import { z } from 'zod';
import { useZodRouteParams } from '~/hooks';
import { useInvalidateQuery } from '~/rspc';
import spaceRoutes from '../space';
import { SpacesContextProvider } from './SpacesProvider';

export const SPACE_ID_PARAMS = z.object({
	spaceId: z.optional(z.string())
});

const Wrapper = () => {
	useInvalidateQuery();

	const params = useZodRouteParams(SPACE_ID_PARAMS);

	console.log('rendering wrapper. spaceId:', params.spaceId);

	return (
		<>
			<SpacesContextProvider currentSpaceId={params.spaceId ?? null}>
				<Outlet />
			</SpacesContextProvider>
		</>
	);
};

export default [
	{
		element: <Wrapper />,
		children: [
			{
				lazy: () => import('./Layout'),
				children: [...spaceRoutes]
			}
		]
	}
] satisfies RouteObject[];
