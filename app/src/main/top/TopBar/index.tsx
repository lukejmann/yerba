import { RefObject } from 'react';
import styled, { useTheme } from 'styled-components/macro';
// @ts-ignore
import { ReactComponent as Logo } from '~/assets/logo';
import { authStore } from '~/rspc';
import { RowFixed } from '~/ui';

const HeaderContainer = styled.div`
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	padding: 0px;

	position: fixed;
	left: 16px;
	right: 16px;
	top: 20px;
`;

const TopBar = () => {
	return (
		<HeaderContainer>
			<Logo style={{ width: '44px' }} />
			<RowFixed
				style={{
					opacity: 0.5,
					fontSize: '8px'
				}}
				onClick={() => {
					authStore.jwt = null;
				}}
			>
				RESET
			</RowFixed>
		</HeaderContainer>
	);
};

export default TopBar;
