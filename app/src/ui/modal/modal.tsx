import { zodResolver } from '@hookform/resolvers/zod';
import * as RadixD from '@radix-ui/react-dialog';
import { animated, useTransition } from '@react-spring/web';
import { ComponentProps, ReactElement, ReactNode, useEffect } from 'react';
import {
	FieldErrors,
	FieldValues,
	FormProvider,
	UseFormHandleSubmit,
	UseFormProps,
	UseFormReturn,
	get,
	useForm,
	useFormContext
} from 'react-hook-form';
import { Puff } from 'react-loading-icons';
import styled, { useTheme } from 'styled-components/macro';
import { proxy, ref, subscribe, useSnapshot } from 'valtio';
import { z } from 'zod';
import SectionButton, { ButtonBase } from '../buttons';
import { ButtonText } from '../common';
import { ItemSubtitle, SectionHeader, TextBase } from '../text';

const AnimatedModalContent = styled(animated(RadixD.Content))`
	overflow-y: auto;

	margin: auto;
	border: ${({ theme }) => theme.border1};
	box-shadow: ${({ theme }) => theme.shadow1Base};
	padding: 0px;
	width: 50vw;
	overflow-y: auto;
	overflow-x: hidden;
	max-width: 400px;
	max-height: 80vh;
	display: flex;
	border-radius: 20px;
	background: white;

	${({ theme }) => theme.widths.deprecated_upToMedium`
	width: 65vw;
	`};
`;

const AnimatedModalOverlay = styled(animated(RadixD.Overlay))`
	z-index: 49;
	// position: absolute;
	// top: 0;
	// right: 0;
	// bottom: 0;
	// left: 0;
	margin: 1px;
	display: grid;
	place-items: center;
	overflow-y: auto;
	border-radius: 1rem;
	// background: ${({ theme }) => theme.backgroundOverlay};
	height: 100vh;
	// background: rgba(0, 0, 0, 0.5);
`;

const FormContent = styled.div`
	display: flex;
	flex-direction: row;
	justify-content: flex-end;
	border-top-width: 1px;
	padding: 0.75rem;
	gap: 0.5rem;
`;

export interface FormProps<T extends FieldValues> extends Omit<ComponentProps<'form'>, 'onSubmit'> {
	form: UseFormReturn<T>;
	disabled?: boolean;
	onSubmit?: ReturnType<UseFormHandleSubmit<T>>;
}

export const Form = <T extends FieldValues>({
	form,
	disabled,
	onSubmit,
	children,
	...props
}: FormProps<T>) => {
	return (
		<FormProvider {...form}>
			<form
				onSubmit={(e) => {
					e.stopPropagation();
					return onSubmit?.(e);
				}}
				{...props}
			>
				<fieldset
					style={{ width: '100%', border: 'none' }}
					disabled={disabled || form.formState.isSubmitting}
				>
					{children}
				</fieldset>
			</form>
		</FormProvider>
	);
};

interface UseZodFormProps<S extends z.ZodSchema>
	extends Exclude<UseFormProps<z.infer<S>>, 'resolver'> {
	schema?: S;
}

export const useZodForm = <S extends z.ZodSchema = z.ZodObject<Record<string, never>>>(
	props?: UseZodFormProps<S>
) => {
	const { schema, ...formProps } = props ?? {};

	return useForm<z.infer<S>>({
		...formProps,
		resolver: zodResolver(schema || z.object({}))
	});
};

export interface ErrorMessageProps {
	name: string;
	className: string;
}

export const ErrorMessage = ({ name }: ErrorMessageProps) => {
	const methods = useFormContext();
	const error = get(methods.formState.errors, name) as FieldErrors | undefined;
	const transitions = useTransition(error, {
		from: { opacity: 0 },
		enter: { opacity: 1 },
		leave: { opacity: 0 },
		clamp: true,
		config: { mass: 0.4, tension: 200, friction: 10, bounce: 0 },
		exitBeforeEnter: true
	});

	return (
		<>
			{transitions((styles, error) => {
				const message = error?.message;
				return typeof message === 'string' ? (
					<animated.div style={styles}>
						<p style={{ width: '90%' }}>{message}</p>
					</animated.div>
				) : null;
			})}
		</>
	);
};

export function createModalState(open = false) {
	return proxy({
		open
	});
}

export type ModalState = ReturnType<typeof createModalState>;

export interface ModalOptions {
	onSubmit?(): void;
}

export interface UseModalProps extends ModalOptions {
	id: number;
}

class ModalManager {
	private idGenerator = 0;
	private state: Record<string, ModalState> = {};

	modals: Record<number, React.FC> = proxy({});

	create(modal: (props: UseModalProps) => ReactElement, options?: ModalOptions) {
		const id = this.getId();

		this.modals[id] = ref(() => modal({ id, ...options }));
		this.state[id] = createModalState(true);

		return new Promise<void>((res) => {
			subscribe(this.modals, () => {
				if (!this.modals[id]) res();
			});
		});
	}

	getId() {
		return ++this.idGenerator;
	}

	getState(id: number) {
		return this.state[id];
	}

	remove(id: number) {
		const state = this.getState(id);

		if (!state) {
			throw new Error(`Modal ${id} not registered!`);
		}

		if (state.open === false) {
			delete this.modals[id];
			delete this.state[id];
		}
	}
}

export const modalManager = new ModalManager();

export function useModal(props: UseModalProps) {
	const state = modalManager.getState(props.id);

	if (!state) throw new Error(`Modal ${props.id} does not exist!`);

	return {
		...props,
		state
	};
}

export function Modals() {
	const modals = useSnapshot(modalManager.modals);

	return (
		<>
			{Object.entries(modals).map(([id, Modal]) => (
				<Modal key={id} />
			))}
		</>
	);
}

export interface ModalProps<S extends FieldValues>
	extends RadixD.DialogProps,
		Omit<FormProps<S>, 'onSubmit'> {
	title?: string;
	description?: string;
	dialog: ReturnType<typeof useModal>;
	loading?: boolean;
	trigger?: ReactNode;

	onSubmit?: ReturnType<UseFormHandleSubmit<S>>;
	children?: ReactNode;
}

export function Modal<S extends FieldValues>({
	form,
	dialog: modal,
	onSubmit,

	...props
}: ModalProps<S>) {
	const stateSnap = useSnapshot(modal.state);

	const transitions = useTransition(stateSnap.open, {
		from: {
			opacity: 0,
			transform: `translateY(20px)`,
			transformOrigin: 'bottom'
		},
		enter: { opacity: 1, transform: `translateY(0px)` },
		leave: { opacity: 0, transform: `translateY(20px)` },
		config: { mass: 0.4, tension: 200, friction: 10, bounce: 0 }
	});

	const setOpen = (v: boolean) => (modal.state.open = v);

	useEffect(
		() => () => {
			modalManager.remove(modal.id);
		},
		[modal.id]
	);

	return (
		<RadixD.Root open={stateSnap.open} onOpenChange={setOpen}>
			{props.trigger && <RadixD.Trigger asChild>{props.trigger}</RadixD.Trigger>}
			{transitions((styles, show) =>
				show ? (
					<RadixD.Portal forceMount>
						<AnimatedModalOverlay
							style={{
								opacity: styles.opacity
								// height: '100vh'
							}}
						>
							<AnimatedModalContent style={styles}>
								<Form
									style={{
										display: 'flex',
										width: '100%'
									}}
									form={form}
									onSubmit={async (e) => {
										e?.preventDefault();
										await onSubmit?.(e);
										modal.onSubmit?.();
										setOpen(false);
									}}
								>
									<div>
										<SectionHeader as={RadixD.Title}>{props.title}</SectionHeader>

										{props.description && (
											<ItemSubtitle as={RadixD.Description}>{props.description}</ItemSubtitle>
										)}

										{props.children}
									</div>
									<FormContent style={{ width: '100%' }}>
										{form.formState.isSubmitting && <Loader />}

										<SectionButton
											//@ts-ignore
											as="button"
											type="submit"
											text="Submit"
											disabled={form.formState.isSubmitting}
										>
											Submit
										</SectionButton>
									</FormContent>
								</Form>
							</AnimatedModalContent>
						</AnimatedModalOverlay>
					</RadixD.Portal>
				) : null
			)}
		</RadixD.Root>
	);
}

export function Loader(props: { className?: string }) {
	const theme = useTheme();
	return <Puff stroke={theme?.border1} strokeOpacity={4} strokeWidth={5} speed={1} />;
}
