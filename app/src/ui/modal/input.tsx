/**
 * Preset styles of the Rebass Text component
 */
import { PropsWithChildren, forwardRef, useId } from 'react';
import { useFormContext } from 'react-hook-form';
import { Text, TextProps as TextPropsOriginal } from 'rebass';
import styled from 'styled-components/macro';
import { FormText, ItemSubtitle, TextBase } from '../text';
import { ErrorMessage } from './modal';

const Input = styled.input`
	font-size: 11px;
	letter-spacing: -0.01em;
	font-weight: 550;
	background: ${({ theme }) => theme.backgroundInteractive};
	border-radius: 2px;
	// outline: 1px solid ${({ theme }) => theme.border1} !important;
	border: none;
	padding: 8px 12px;
	width: 100%;
	outline: 0.5px solid ${({ theme }) => theme.border1};
	&::-webkit-outer-spin-button,
	&::-webkit-inner-spin-button {
		-webkit-appearance: none;
	}
	// color: ${({ theme, color }) => (color === 'red' ? theme.accentFailure : theme.text1)};
	text-align: left;

	::placeholder {
		color: ${({ theme }) => theme.text3};
	}
`;

const Label = styled(ItemSubtitle)`
	color: ${({ theme }) => theme.text1};
`;

const InputRowContainer = styled.div`
	display: flex;
	flex-direction: row;
	align-items: center;
`;

export interface UseFormFieldProps extends PropsWithChildren {
	name: string;
	label?: string;
}

export const useFormField = <P extends UseFormFieldProps>(props: P) => {
	const { name, label, ...otherProps } = props;
	const { formState, getFieldState } = useFormContext();
	const state = getFieldState(props.name, formState);
	const id = useId();

	return {
		formFieldProps: { id, name, label, error: state.error?.message },
		childProps: { ...otherProps, id, name }
	};
};

interface FormFieldProps extends Omit<UseFormFieldProps, 'label'> {
	id: string;
	name: string;
	label?: string;
}

export const FormField = (props: FormFieldProps) => {
	return (
		<div>
			{props.label && <Label>{props.label}</Label>}
			{props.children}
			<ErrorMessage name={props.name} className="mt-1 w-full text-xs" />
		</div>
	);
};

type InputProps = Omit<React.ComponentProps<'input'>, 'size'>;

export interface InpuRowProps extends UseFormFieldProps, InputProps {
	name: string;
}

export const InputRow = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
	return (
		<InputRowContainer>
			<Input {...props} ref={ref} />
		</InputRowContainer>
	);
});

export const FormInputRow = forwardRef<HTMLInputElement, InpuRowProps>((props, ref) => {
	const { formFieldProps, childProps } = useFormField(props);

	return (
		<FormField {...formFieldProps}>
			<InputRow {...childProps} ref={ref} />
		</FormField>
	);
});
