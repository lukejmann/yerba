import { RouteObject } from 'react-router-dom';
import { z } from 'zod';
import SpaceMain from './SpaceMain';
// import SpaceMain from './SpaceMain';
import { NoSpaceSelected } from './empty-state';

const PARAMS = z.object({
	spaceId: z.optional(z.string())
});

export default [
	{
		lazy: () => import('./Layout'),
		children: [
			{
				path: '/',
				index: true,
				element: <NoSpaceSelected />
			},
			{
				path: ':spaceId',
				element: <SpaceMain />
			}
		]
	}
] satisfies RouteObject[];
