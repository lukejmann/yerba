import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components/macro';
import { proxy, subscribe, useSnapshot } from 'valtio';
import { proxyMap, subscribeKey } from 'valtio/utils';
import { useSpacesContext } from '~/main/user/SpacesProvider';
import {
	FileWrapped,
	Message,
	MessageWithTasksAndPeer,
	useAuth,
	useRspcSpaceContext,
	useSpaceMutation,
	useSpaceQuery,
	useSpaceSubscription
} from '~/rspc';
import {
	ItemStatus,
	ItemSubtitle,
	ItemTitle,
	RowBetween,
	RowFlat,
	SectionHeader,
	opacify
} from '~/ui';
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

// const STEP_SIZE = 10;
// const chatStore = proxy({
// 	messages: [] as Message[],
// 	cursor: 0
// });

export default () => {
	const { space, spaces, currentSpaceId } = useSpacesContext();
	const jwt = useAuth();

	const [cursor, setCursor] = useState<number>(0);
	const grabNext = () => {
		setCursor((c) => c + 1);
	};

	const ctx = useRspcSpaceContext();
	const queryClient = useQueryClient();

	const messagesQuery = useInfiniteQuery({
		// enabled: isObjectQuery,
		queryKey: [
			'messages.list',
			{
				jtw_token: jwt,
				space_id: currentSpaceId,
				arg: {
					take: 50
				}
			}
		] as const,
		queryFn: ({ pageParam: cursor, queryKey }) =>
			ctx.client.query([
				'messages.list',
				{
					...queryKey[1].arg,
					cursor
				}
			]),
		getNextPageParam: (lastPage) => lastPage.cursor ?? undefined
	});

	const queryMessages = useMemo(
		() => messagesQuery.data?.pages?.flatMap((d) => d.messages) ?? [],
		[messagesQuery.data]
	);

	const [subMessages, setSubMessages] = useState<MessageWithTasksAndPeer[]>([]);

	useSpaceSubscription(['messages.updates'], {
		onStarted: () => {
			// console
			console.log('messages.updates init');
		},
		onError: (err) => {
			console.error('messages.updates error', err);
		},
		onData: (newOrUpdatesMessages: MessageWithTasksAndPeer[]) => {
			console.log('messages.updates data', newOrUpdatesMessages);
			setSubMessages(newOrUpdatesMessages);
		}
	});

	const [outboxMesages, setOutboxMessages] = useState<Message[]>([]);

	const [sendError, setSendError] = useState<string | null>(null);
	const sendMessage = useSpaceMutation(['messages.send'], {
		onSuccess: (msg) => {
			// cons
			setSendError(null);
			setOutboxMessages([...outboxMesages, msg]);
		},
		onError: (err) => {
			setSendError(err.message);
		}
	});

	const messages = useMemo(() => {
		const mapById = new Map<string, Message[]>();
		const subMessagesExp = subMessages
			.map((m) => {
				const ms = [m as Message];
				const responseMsg = m.response_message;
				if (responseMsg) ms.push(responseMsg);
				const userMsg = m.user_message;
				if (userMsg) ms.push(userMsg);
				return ms;
			})
			.flat();

		console.log('subMessagesExp', subMessagesExp);

		const all = [...queryMessages, ...subMessagesExp, ...outboxMesages];
		all.forEach((m) => {
			const messages = mapById.get(m.id_str) ?? [];
			mapById.set(m.id_str, [...messages, m]);
		});
		// TODO decide how to filter
		return ([...mapById.values()].map((ms) => ms[0]) as Message[]).sort(
			(a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
		);
	}, [queryMessages, subMessages, outboxMesages]);

	// reset on space change
	useEffect(() => {
		setCursor(0);
		setSendError(null);
		sendMessage.reset();
	}, [currentSpaceId]);

	return (
		// <ChatWrapper>
		<FloatingBarWithContent
			onReachTop={messagesQuery.fetchNextPage}
			topBarContent={
				<RowBetween padding={'md'}>
					<SectionHeader>Chat</SectionHeader>
				</RowBetween>
			}
			scrollContent={messages.map((message, index) => {
				const align = message.is_user_message ? 'right' : 'left';
				return (
					<ChatMessageRow align={align} key={index}>
						<ChatMessageContainer align={align} key={index}>
							<ChatMessageText index={index} align={align}>
								{message.text}
							</ChatMessageText>
						</ChatMessageContainer>
					</ChatMessageRow>
				);
			})}
			bottomBarContent={
				<ChatInputBar
					sendMessage={(message: string) => {
						sendMessage.mutate({
							text: message
						});
					}}
					error={sendError}
				/>
			}
			prefer="bottom"
		/>
		// </ChatWrapper>
	);
};

const ChatMessageText = styled.div<{ align: 'left' | 'right'; index: number }>`
	display: flex;
	flex-direction: column;
	flex: 1 0 0;
	// color: #b3b6ca;
	text-shadow: -32.98798751831055px 24.740989685058594px 74.22296905517578px 0px rgba(0, 0, 0, 0.3);
	font-weight: 600;
	text-align: ${({ align }) => align};
	color: ${({ theme, align }) =>
		align === 'left' ? theme.otherMessageText : theme.userMessageText};
	z-index: ${({ index }) => index};
	font-size: 11px;
	font-weight: 500;
	width: fit-content;
`;

const ChatMessageRow = styled.div<{ align: 'left' | 'right' }>`
	display: flex;
	width: 100%;
	align-items: ${({ align }) => (align === 'left' ? 'flex-start' : 'flex-end')};

	flex-direction: column;
`;

const ChatMessageContainer = styled.div<{ align: 'left' | 'right' }>`
	display: flex;
	width: fit-content;
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
	box-shadow: ${({ align }) => (align == 'left' ? '-' : '')}13px 10px 30px 0px rgba(0, 0, 0, 0.1);
	margin: 10px;
	padding: 1px -1.5px;
`;

const ChatInputBarContainer = styled.div`
	display: flex;
	width: 100%;
	// padding: 11px 8.577px;
	justify-content: space-between;
	align-items: flex-end;
	// border-radius: 8px;
	// border: 1.072px solid var(--a, #e6e6e6);
	background: none;
	// background: rgba(255, 255, 255, 0.38);
	// box-shadow: -39px 30px 90px 0px rgba(0, 0, 0, 0.1);
	// backdrop-filter: blur(7px);
`;
const ChatInputBarInput = styled.input`
	display: flex;
	flex-direction: column;
	flex: 1 0 0;
	color: ${({ theme }) => theme.text1};
	text-shadow: -32.98798751831055px 24.740989685058594px 74.22296905517578px 0px rgba(0, 0, 0, 0.3);
	font-weight: 500;
	font-size: 12px;
	outline: none;
	border: none;
	min-height: 20px;
	background: none;
`;

const ChatInputBar = ({
	sendMessage,
	error
}: {
	sendMessage?: (message: string) => void;
	error: string | null;
}) => {
	const [message, setMessage] = useState<string>('');

	const send = () => {
		sendMessage?.(message);
		setMessage('');
	};

	// on press enter
	useEffect(() => {
		const handleEnter = (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				send();
			}
		};
		window.addEventListener('keydown', handleEnter);
		return () => {
			window.removeEventListener('keydown', handleEnter);
		};
	}, [message]);

	return (
		<ChatInputBarContainer>
			<ChatInputBarInput
				placeholder={'Type a message...'}
				onChange={(e) => setMessage(e.target.value)}
				value={message}
			/>
			<SectionButton onClick={() => send} text="Send" />
			<div style={{ position: 'absolute', top: -10, left: 6 }}>
				{error && <ItemStatus>{error}</ItemStatus>}
			</div>
		</ChatInputBarContainer>
	);
};
