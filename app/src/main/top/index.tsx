import { Navigate, Outlet, RouteObject } from 'react-router-dom';
import { authStore } from '~/rspc';
import userRoutes from '../user';

export default [
	{
		lazy: () => import('./Layout'),
		children: [
			{
				path: 'no-user',
				lazy: () => import('./auth/no-user')
			},
			...userRoutes
		]
	}
] as RouteObject[];
