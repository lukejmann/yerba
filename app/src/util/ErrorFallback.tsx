import { FallbackProps } from 'react-error-boundary';
import { useRouteError } from 'react-router';
import styled, { css } from 'styled-components/macro';
import { useDebugState } from '~/main';
import { ButtonBase } from '~/ui/buttons';

export function RouterErrorBoundary() {
	const error = useRouteError();
	return (
		<ErrorPage
			message={(error as any).toString()}
			reloadBtn={() => {
				location.reload();
			}}
		/>
	);
}

const StyledComponentsExample = styled.div`
	color: red;
`;

const StyledErrorPage = styled.div`
	display: flex;
	height: 100vh;
	width: 100vw;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border: 1px solid;
	background-color: #2980d8;
	padding: 1rem;
`;

const StyledMessage = styled.h1`
	margin: 0.75rem 0;
	font-size: 1.5rem;
	font-weight: bold;
	color: #111827;
`;

const StyledSubmessage = styled.pre`
	margin: 0.5rem 0;
	font-size: 0.875rem;
	color: #6b7280;
`;

const StyledHeader = styled.p`
	margin: 0.75rem 0;
	font-size: 0.875rem;
	font-weight: bold;
	color: #6b7280;
`;

const StyledAlert = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	padding-top: 3rem;
`;

const StyledButton = styled(ButtonBase)`
	margin-top: 0.5rem;
	max-width: 16rem;
	border: transparent;
	background-color: #ac2626;
`;

export default ({ error, resetErrorBoundary }: FallbackProps) => (
	<ErrorPage message={`Error: ${error.message}`} reloadBtn={resetErrorBoundary} />
);

export function ErrorPage({
	reloadBtn,
	message,
	submessage
}: {
	reloadBtn?: () => void;
	message: string;
	submessage?: string;
}) {
	const debug = useDebugState();

	return (
		<StyledErrorPage>
			<StyledHeader>APP CRASHED</StyledHeader>
			<pre>{message}</pre>
			{submessage && <StyledSubmessage>{submessage}</StyledSubmessage>}
			<div>{reloadBtn && <ButtonBase onClick={reloadBtn}>Reload</ButtonBase>}</div>
		</StyledErrorPage>
	);
}
