import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDebugState } from '~/main';
import { authStore, useAuth, useBridgeMutation, useUserMutation } from '~/rspc';
import { ItemSubtitle, ItemTitle } from '~/ui';

export const Component = () => {
	console.log('rendering no user');

	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const debugState = useDebugState();
	const auth = useAuth();

	const [userStatus, setUserStatus] = useState('Creating your user...');

	const [firstSpaceStatus, setFirstSpaceStatus] = useState('Creating your space...');

	const [userCreated, setUserCreated] = useState(false);

	const [spaceCreated, setSpaceCreated] = useState(false);

	// reset when auth is null for first time
	useEffect(() => {
		if (!auth) {
			setUserCreated(false);
			setSpaceCreated(false);
		}
	}, [auth]);

	const createUserMut = useBridgeMutation('users.create', {
		// retry: false,
		onSuccess: (auth) => {
			console.log('created user', auth);
			authStore.jwt = auth.token;
			console.log('auth', auth);
			setUserStatus('Done!');
			navigate(`/`, { replace: true });
		},
		onError: () => {
			console.error('Failed to create user');
			// navigate('/onboarding/');
		}
	});

	const createUser = async () => {
		createUserMut.mutate(undefined);
		return;
	};

	useEffect(() => {
		if (userCreated) return;
		setUserCreated(true);
		createUser();
		const timer = setTimeout(() => {
			setUserStatus('Almost done...');
		}, 2000);
		const timer2 = setTimeout(() => {
			if (debugState.enabled) {
				setUserStatus(`You're running in development, this will take longer...`);
			}
		}, 5000);
		return () => {
			clearTimeout(timer);
			clearTimeout(timer2);
		};
	}, [auth]);

	return (
		<div
			style={{
				height: '100%, width: 100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center'
			}}
		>
			<ItemTitle>Creating guest</ItemTitle>
			<ItemSubtitle>{userStatus}</ItemSubtitle>
			<ItemSubtitle>{firstSpaceStatus}</ItemSubtitle>
		</div>
	);
};
