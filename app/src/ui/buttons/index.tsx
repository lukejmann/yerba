import { PropsWithChildren } from 'react';
import styled from 'styled-components/macro';

export const ButtonTextBase = styled.div`
	font-family: 'Satoshi';
	font-style: normal;
	font-weight: 600;
	font-size: 11.705px;
	// line-height: 17px;
	width: fit-content;

	color: #b3b6ca;
`;

export const ButtonBase = styled.div<{ disabled?: boolean }>`
	position: relative;
	box-sizing: border-box;

	/* Auto layout */

	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	padding: 4px 8.247px;
	gap: 10.31px;

	width: fit-content;
	height: fit-content;

	background: #ffffff;

	border: 1.43548px solid #e6e6e6;
	border-radius: 8.247px;

	&:hover {
		cursor: pointer;
	}

	${({ disabled }) =>
		disabled &&
		`
        opacity: 0.5;
        &:hover {
            cursor: not-allowed;
        }
    `}
`;

interface SectionButtonProps extends PropsWithChildren {
	text?: string;
	onClick?: () => void;
	disabled?: boolean;
}

export default function SectionButton({ text, onClick, disabled, children }: SectionButtonProps) {
	return (
		<ButtonBase onClick={onClick ? onClick : undefined} disabled={disabled}>
			<ButtonTextBase>{text}</ButtonTextBase>
			{children && (
				<div
					style={{
						position: 'absolute',
						opacity: 0,
						right: 0,
						top: 0,
						bottom: 0,
						left: 0,
						cursor: 'pointer'
					}}
				>
					{children}
				</div>
			)}
		</ButtonBase>
	);
}
