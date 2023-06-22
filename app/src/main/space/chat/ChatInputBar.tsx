import { animated, useInView, useSpring } from '@react-spring/web';
import React, { PropsWithChildren, ReactNode } from 'react';
import useMeasure from 'react-use-measure';
import styled, { useTheme } from 'styled-components/macro';

const ChatInputBarContainer = styled(animated.div)`
	display: flex;
	flex-direction: column;
	align-items: center;

	gap: 0px;

	position: absolute;
	// width: calc(100%);
	// height: fit-content;
	left: 6px;
	right: 6px;
	bottom: 6px;

	z-index: 110;

	padding: 8px 8px 8px 8px;

	border-radius: 8px;
`;

interface ChatInputBarProps {
	ref?: any;
}

const ChatInputBar = React.forwardRef<HTMLDivElement, ChatInputBarProps>(function ChatInputBar(
	{},
	ref
) {
	const styles = useSpring({
		// border: float ? '1px solid #e6e6e6' : '1px solid #e6e6e600',
		// boxShadow: float ? '-39px 30px 90px rgba(0, 0, 0, 0.1)' : 'none',
		// backdropFilter: float ? 'blur(7px)' : 'blur(0.1px)',
		// backgroundColor: float ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0)',

		config: {
			tension: 300
		}
	});

	return (
		<ChatInputBarContainer ref={ref} style={styles}>
			{/* {barContent} */}
		</ChatInputBarContainer>
	);
});

export default ChatInputBar;
