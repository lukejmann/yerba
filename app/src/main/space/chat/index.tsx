import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import Latex from 'react-latex-next';
import styled from 'styled-components/macro';
import { useSpacesContext } from '~/main/user/SpacesProvider';
import {
	Message,
	MessageWithTasksAndPeer,
	useAuth,
	useRspcSpaceContext,
	useSpaceMutation,
	useSpaceSubscription
} from '~/rspc';
import { ItemStatus, RowBetween, SectionHeader } from '~/ui';
import FloatingBarWithContent from '~/ui/FloatingBar';
import SectionButton from '~/ui/buttons';

const ChatWrapper = styled.div<{ selected?: boolean }>`
	display: flex;

	flex-direction: column;
	border-radius: 9px;
	justify-content: space-between;
	align-items: center;

	box-shadow: -33.766px 25.9738px 77.9215px rgba(0, 0, 0, 0.14);
	background: ${({ theme }) => theme.backgroundFloatingBase};

	height: 100%;
	border-radius: 9px;
	border: 1px solid var(--a, #e6e6e6);
	background: rgba(255, 255, 255, 0.01);

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
		queryKey: [
			'messages.list',
			{
				jwt: jwt,
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

	useEffect(() => {
		queryClient.invalidateQueries(['messages.list']);
		console.log('messages.list reset');
	}, [currentSpaceId]);

	const queryMessages = useMemo(
		() => messagesQuery.data?.pages?.flatMap((d) => d.messages) ?? [],
		[messagesQuery.data]
	);

	const [subMessages, setSubMessages] = useState<MessageWithTasksAndPeer[]>([]);

	useSpaceSubscription(['messages.updates'], {
		onStarted: () => {
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

		return ([...mapById.values()].map((ms) => ms[0]) as Message[]).sort(
			(a, b) => new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
		);
	}, [queryMessages, subMessages, outboxMesages]);

	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollToEnd = () => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: 'smooth'
		});
		console.log('scrollToEnd', scrollRef.current?.scrollHeight);
	};

	useEffect(() => {
		setCursor(0);
		setSendError(null);
		sendMessage.reset();
		scrollToEnd();
	}, [currentSpaceId]);

	return (
		<FloatingBarWithContent
			onReachTop={messagesQuery.fetchNextPage}
			topBarContent={
				<RowBetween padding={'md'}>
					<SectionHeader>Chat</SectionHeader>
				</RowBetween>
			}
			scrollRef={scrollRef}
			scrollContent={messages.map((message, index) => {
				const align = message.is_user_message ? 'right' : 'left';
				return (
					<ChatMessageRow align={align} key={message.id_str}>
						<ChatMessageContainer align={align} key={index}>
							<ChatMessageText index={index} align={align}>
								<Latex>{message.text}</Latex>
							</ChatMessageText>
						</ChatMessageContainer>
					</ChatMessageRow>
				);
			})}
			bottomBarContent={
				<ChatInputBar
					onFocus={() => {
						scrollToEnd();
					}}
					sendMessage={(message: string) => {
						sendMessage.mutate({
							text: message
						});
						scrollToEnd();
					}}
					error={sendError}
				/>
			}
			prefer="bottom"
		/>
	);
};

const ChatMessageText = styled.div<{ align: 'left' | 'right'; index: number }>`
	display: flex;
	flex-direction: column;
	flex: 1 0 0;

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

	justify-content: space-between;
	align-items: flex-end;

	background: none;
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
	onFocus,
	error
}: {
	sendMessage?: (message: string) => void;
	onFocus?: () => void;
	error: string | null;
}) => {
	const [message, setMessage] = useState<string>('');

	const send = () => {
		sendMessage?.(message);
		setMessage('');
	};

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
				onFocus={onFocus}
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
