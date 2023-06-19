import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { authStore } from '~/rspc';

export const AuthUpdater = () => {
	const { jwt } = authStore;

	const navigate = useNavigate();

	useEffect(() => {
		if (!jwt) navigate(`no-user`, { replace: true });
	}, [jwt, navigate]);

	return <></>;
};
