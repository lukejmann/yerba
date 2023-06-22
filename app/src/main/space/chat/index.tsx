import { useEffect, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components/macro';
import { proxy, subscribe, useSnapshot } from 'valtio';
import { proxyMap, subscribeKey } from 'valtio/utils';
import { useSpacesContext } from '~/main/user/SpacesProvider';
import { FileWrapped, Task, useSpaceMutation, useSpaceQuery, useSpaceSubscription } from '~/rspc';
import { ItemSubtitle, ItemTitle, RowBetween, RowFlat, SectionHeader, opacify } from '~/ui';
import FloatingBarWithContent from '~/ui/FloatingBar';
import SectionButton from '~/ui/buttons';

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
	border-radius: 9px;
	border: 1px solid var(--a, #e6e6e6);
	background: rgba(255, 255, 255, 0.01);
	/* b */
	box-shadow: -39px 30px 90px 0px rgba(0, 0, 0, 0.07);
	backdrop-filter: blur(7px);
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

interface MessageProps {
	text: string;
	align: 'left' | 'right';
}

const chatStore = proxy({
	// start with 100 random messages
	messages: Array.from({ length: 100 }, (_, i) => ({
		text: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
		align: i % 2 === 0 ? 'left' : 'right'
	}))
});

export default () => {
	const { space, spaces, currentSpaceId } = useSpacesContext();
	const { messages } = useSnapshot(chatStore);
	const addMessage = () => {
		// generate random string of length 100-500 chars
		const randomString =
			Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		chatStore.messages.push({
			text: randomString,
			align: messages.length % 2 === 0 ? 'left' : 'right'
		});
	};

	return (
		// <ChatWrapper>
		<FloatingBarWithContent
			topBarContent={
				<RowBetween padding={'md'}>
					<SectionHeader>Chat</SectionHeader>
				</RowBetween>
			}
			scrollContent={messages.map((message, index) => (
				<ChatMessageContainer align={message.align} key={index}>
					<ChatMessageText index={index} align={message.align}>
						{message.text}
					</ChatMessageText>
				</ChatMessageContainer>
			))}
			bottomBarContent={<ChatInputBar onSend={addMessage} />}
		/>
		// </ChatWrapper>
	);
};

const ChatMessageText = styled.div<{ align: 'left' | 'right'; index: number }>`
	display: flex;
	flex-direction: column;
	flex: 1 0 0;
	color: #b3b6ca;
	text-shadow: -32.98798751831055px 24.740989685058594px 74.22296905517578px 0px rgba(0, 0, 0, 0.3);
	font-weight: 700;
	text-align: ${({ align }) => align};
	color: ${({ theme, align }) =>
		align === 'left' ? theme.otherMessageColor : theme.userMessageColor};
	z-index: ${({ index }) => index};
`;

const ChatMessageContainer = styled.div<{ align: 'left' | 'right' }>`
	display: flex;
	width: 100%;
	max-width: 500px;
	padding: 11px 8.577px;
	justify-content: space-between;
	align-items: flex-start;
	align-content: flex-start;
	row-gap: 275.526px;
	flex-wrap: wrap;
	border-radius: 9px;
	border: 1.072px solid var(--a, #e6e6e6);
	background: ${({ theme, align }) =>
		align === 'left' ? theme.otherMessageBackground : theme.userMessageBackground};
	box-shadow: -39px 30px 90px 0px rgba(0, 0, 0, 0.1);
	// backdrop-filter: blur(7px);
`;

const ChatInputBarContainer = styled.div`
	display: flex;
	width: 100%;
	padding: 11px 8.577px;
	justify-content: space-between;
	align-items: flex-end;
	border-radius: 8px;
	border: 1.072px solid var(--a, #e6e6e6);
	background: none;
	// background: rgba(255, 255, 255, 0.38);
	// box-shadow: -39px 30px 90px 0px rgba(0, 0, 0, 0.1);
	// backdrop-filter: blur(7px);
`;
const ChatInputBarInput = styled.input`
	display: flex;
	flex-direction: column;
	flex: 1 0 0;
	color: #b3b6ca;
	text-shadow: -32.98798751831055px 24.740989685058594px 74.22296905517578px 0px rgba(0, 0, 0, 0.3);
	font-weight: 700;
	height: 100px;
`;

const ChatInputBar = ({ onSend }: { onSend?: () => void }) => {
	return (
		<ChatInputBarContainer>
			<ChatInputBarInput placeholder={'Type a message...'} />
			<SectionButton onClick={onSend} text="Send" />
		</ChatInputBarContainer>
	);
};
