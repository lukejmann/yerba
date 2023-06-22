import { Outlet } from 'react-router';
import styled from 'styled-components/macro';
import TopBar from './TopBar';
import { AuthUpdater } from './auth/auth-updater';

const BottomContentContainer = styled.div`
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	top: 42px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 12px;
`;

export const Component = () => {
	return (
		<>
			<AuthUpdater />
			<TopBar />
			<BottomContentContainer>
				<Outlet />
			</BottomContentContainer>
		</>
	);
};
