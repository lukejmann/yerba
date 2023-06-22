import { useState } from 'react';
import { z } from 'zod';
import { authStore, useBridgeMutation, useUserMutation } from '~/rspc';
import { FormInputRow, Modal, UseModalProps, useModal, useZodForm } from '~/ui';

interface AuthModalProps extends UseModalProps {
	type: 'sign_in' | 'sign_up';
}

const schema = z.object({
	username: z.string().min(3),
	password: z.string().min(8)
});

export default (props: AuthModalProps) => {
	const signUp = useUserMutation('users.signUp', {
		onError: () => {
			console.error('Failed to create user');
		},
		onSuccess: (jwt) => {
			console.log('auth: Created user');
			authStore.jwt = jwt;
		}
	});

	const login = useBridgeMutation('users.logIn', {
		onError: () => {
			console.error('Failed to create user');
		},
		onSuccess: (jwt) => {
			console.log('auth: Logged in');
			authStore.jwt = jwt;
		}
	});
	// });

	const form = useZodForm({
		schema,
		defaultValues: {
			username: '',
			password: ''
		}
	});

	const [passes, setPasses] = useState([4]);

	return (
		<Modal
			form={form}
			onSubmit={form.handleSubmit((data: any) => {
				console.log("in auth modal's onSubmit");
				props.type === 'sign_in' ? login.mutateAsync(data) : signUp.mutateAsync(data);
			})}
			dialog={useModal(props)}
			title={props.type === 'sign_in' ? 'Sign In' : 'Sign Up'}
			description={props.type === 'sign_in' ? 'Sign in to your account' : 'Create a new account'}
			loading={login.isLoading || signUp.isLoading}
		>
			<FormInputRow {...form.register('username', { required: true })} placeholder="Username" />
			<FormInputRow {...form.register('password', { required: true })} placeholder="Password" />
		</Modal>
	);
};
