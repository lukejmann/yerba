import { RefObject } from 'react';
import styled, { useTheme } from 'styled-components/macro';
// @ts-ignore
import { ReactComponent as Logo } from '~/assets/logo';
import { RowFixed } from '~/ui';
import SectionButton from '~/ui/buttons';
import { modalManager } from '~/ui/modal/modal';
import AuthModal from './AuthModal';

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
			>
				<SectionButton
					onClick={() => {
						console.log('clicked');
						modalManager.create((props: any) => <AuthModal type="sign_up" {...props} />);
					}}
				>
					Sign in / Sign up
				</SectionButton>
			</RowFixed>
		</HeaderContainer>
	);
};

export default TopBar;
