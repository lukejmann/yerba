import { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components/macro';
import { proxy, subscribe, useSnapshot } from 'valtio';
import { proxyMap, subscribeKey } from 'valtio/utils';
import { useSpacesContext } from '~/main/user/SpacesProvider';
import { FileWrapped, Task, useSpaceMutation, useSpaceQuery, useSpaceSubscription } from '~/rspc';
import { ItemSubtitle, ItemTitle, RowBetween, RowFlat, SectionHeader, opacify } from '~/ui';
import FloatingBarWithContent from '~/ui/FloatingBar';
import SectionButton from '~/ui/buttons';
import ChatInputBar from './ChatInputBar';

const ChatWrapper = styled.div<{ selected?: boolean }>`
	display: flex;
	// padding: 12px 8px;
	flex-direction: column;
	border-radius: 9px;
	justify-content: space-between;
	align-items: center;
	// align-self: stretch;
	box-shadow: -33.766px 25.9738px 77.9215px rgba(0, 0, 0, 0.14);
	background: ${({ theme }) => theme.backgroundFloatingBase};
	// background: red;
	height: 100%;
`;

const ChatContentWrapper = styled.div`
	display: flex;
	width: 100%;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;
`;

const ChatTopBar = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	align-self: stretch;
	width: 100%;
	padding: 12px 8px;
`;

export default () => {
	const { space, spaces, currentSpaceId } = useSpacesContext();

	return (
		<FloatingBarWithContent
			barContent={
				<RowBetween padding={'md'}>
					<SectionHeader>Chat</SectionHeader>
				</RowBetween>
			}
			scrollContent={[<></>]}
			extraContent={[<ChatInputBar />]}
		/>
	);
};
