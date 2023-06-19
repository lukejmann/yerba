import { Navigate, Outlet, RouteObject } from 'react-router-dom';
import { authStore, useCachedSpaces } from '~/rspc';
import userRoutes from '../user';

const Index = () => {
	console.log('rendering index');
	const spaces = useCachedSpaces();

	const { jwt } = authStore;

	if (!jwt) return <Navigate to="no-user" />;

	return <Outlet />;
};

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
