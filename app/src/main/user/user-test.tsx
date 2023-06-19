import { Navigate, Outlet, useNavigate } from 'react-router';
import { authStore } from '~/rspc';

export const UserTestComponent = () => {
	const navigate = useNavigate();
	const { jwt } = authStore;
	if (!jwt) return <Navigate to="no-user" />;

	console.log('rendering user test');

	return <div>User logged in</div>;
};
