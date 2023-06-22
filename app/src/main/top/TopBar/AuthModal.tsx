import { useState } from 'react';
import { z } from 'zod';
import { useBridgeMutation, useUserMutation } from '~/rspc';
import { FormInputRow, Modal, UseModalProps, useModal, useZodForm } from '~/ui';

interface AuthModalProps extends UseModalProps {
	type: 'sign_in' | 'sign_up';
}

const schema = z.object({
	username: z.string().min(3),
	password: z.string().min(8)
});

export default (props: AuthModalProps) => {
	// const login = useBridgeMutation('users.create', {
	// 	onError: () => {
	// 		console.error('Failed to create user');
	// 	}
	// });

	// const signUp = useUserMutation('users.attach_jwt', {
	// 	onError: () => {
	// 		console.error('Failed to create user');
	// 	}
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
			onSubmit={form.handleSubmit(
				(data: any) => {}
				// props.type === 'sign_in' ? login.mutateAsync(data) : signUp.mutateAsync(data)
			)}
			dialog={useModal(props)}
			title={props.type === 'sign_in' ? 'Sign In' : 'Sign Up'}
			description="Configure your erasure settings."
			loading={false}
			// loading={login.isLoading || signUp.isLoading}
		>
			<FormInputRow {...form.register('username', { required: true })} placeholder="Username" />
		</Modal>
	);
};
