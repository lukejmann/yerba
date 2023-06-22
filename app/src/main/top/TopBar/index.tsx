import { RefObject } from 'react';
import styled, { useTheme } from 'styled-components/macro';
// @ts-ignore
import { ReactComponent as Logo } from '~/assets/logo';
import { authStore, useAccount, useAppContext } from '~/rspc';
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
	const { data: account } = useAccount();
	// const
	return (
		<HeaderContainer>
			<Logo style={{ width: '44px' }} />
			<RowFixed
				style={{
					opacity: 0.5,
					fontSize: '8px',
					gap: '8px'
				}}
			>
				{!account ? (
					<>
						<SectionButton
							onClick={() => {
								console.log('clicked');
								modalManager.create((props: any) => <AuthModal type="sign_up" {...props} />);
							}}
							text="Sign up"
						></SectionButton>
						<SectionButton
							onClick={() => {
								console.log('clicked');
								modalManager.create((props: any) => <AuthModal type="sign_in" {...props} />);
							}}
							text="Sign in"
						></SectionButton>
					</>
				) : (
					<>
						{account.username}
						<SectionButton
							onClick={() => {
								authStore.jwt = null;
							}}
							text="Logout"
						></SectionButton>
					</>
				)}
			</RowFixed>
		</HeaderContainer>
	);
};

export default TopBar;
