import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDebugState } from '~/main';
import { useAuth, useBridgeMutation, useSetAuth, useUserMutation } from '~/rspc';
import { ItemSubtitle, ItemTitle } from '~/ui';

export const Component = () => {
	console.log('rendering no user');

	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const debugState = useDebugState();
	const auth = useAuth();

	const setAuth = useSetAuth();

	const [userStatus, setUserStatus] = useState('Creating your user...');

	const [firstSpaceStatus, setFirstSpaceStatus] = useState('Creating your space...');

	const createUserMut = useBridgeMutation('users.create', {
		// retry: false,
		onSuccess: (auth) => {
			setAuth(auth.token);
			setUserStatus('Done!');
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

	const userCreated = useRef(false);

	useEffect(() => {
		console.log('userCreated.current', userCreated.current);
		if (userCreated.current) return;
		userCreated.current = true;
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userCreated.current]);

	const createSpace = useUserMutation('spaces.create', {
		onSuccess: (space) => {
			queryClient.setQueryData(['spaces.list'], (spaces: any) => [...(spaces || []), space]);

			navigate(`/`, { replace: true });
		},
		onError: () => {
			console.error('Failed to create space');
		}
	});

	const create = async () => {
		createSpace.mutate({
			name: 'First Space'
		});

		return;
	};

	const created = useRef(false);

	useEffect(() => {
		if (created.current && !auth) return;
		created.current = true;
		create();
		const timer = setTimeout(() => {
			setFirstSpaceStatus('Almost done...');
		}, 2000);
		const timer2 = setTimeout(() => {
			if (debugState.enabled) {
				setFirstSpaceStatus(`You're running in development, this will take longer...`);
			}
		}, 5000);
		return () => {
			clearTimeout(timer);
			clearTimeout(timer2);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
