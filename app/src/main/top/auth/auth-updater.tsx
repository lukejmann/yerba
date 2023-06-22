import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { authStore, useAuth } from '~/rspc';

export const AuthUpdater = () => {
	const jwt = useAuth();

	const navigate = useNavigate();

	useEffect(() => {
		if (!jwt) navigate(`no-user`, { replace: true });
	}, [jwt, navigate]);

	return <></>;
};
