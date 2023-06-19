import { animated, useInView, useSpring } from '@react-spring/web';
import React, { PropsWithChildren, ReactNode } from 'react';
import useMeasure from 'react-use-measure';
import styled, { useTheme } from 'styled-components/macro';

const FloatingBarContainer = styled(animated.div)`
	display: flex;
	flex-direction: column;
	align-items: center;

	gap: 0px;

	position: absolute;
	// width: calc(100%);
	// height: fit-content;
	left: 6px;
	right: 6px;
	top: 6px;

	z-index: 100;

	padding: 8px 8px 8px 8px;

	border-radius: 8px;
`;

interface FloatingBarProps {
	barContent?: ReactNode;
	float: boolean;
	ref?: any;
}

export const FloatingBar = React.forwardRef<HTMLDivElement, FloatingBarProps>(function FloatingBar(
	{ barContent, float },
	ref
) {
	const styles = useSpring({
		border: float ? '1px solid #e6e6e6' : '1px solid #e6e6e600',
		boxShadow: float ? '-39px 30px 90px rgba(0, 0, 0, 0.1)' : 'none',
		backdropFilter: float ? 'blur(7px)' : 'blur(0.1px)',
		backgroundColor: float ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0)',

		config: {
			tension: 300
		}
	});

	return (
		<FloatingBarContainer ref={ref} style={styles}>
			{barContent}
		</FloatingBarContainer>
	);
});

const FloatingBarScrollContainer = styled(animated.div)`
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0px;
	overflow: visible;
`;

const FloatingBarScrollContent = styled(animated.div)`
	position: absolute;
	height: 100%;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 9px;

	overflow-x: visible !important;
	overflow-y: auto;
	z-index: 0;

	scrollbar-width: none;
	-ms-overflow-style: none;
	&::-webkit-scrollbar {
		display: none;
	}

	padding: 12px 8px;
`;

interface FloatingBarWithContentProps {
	barContent?: ReactNode;
	scrollContent?: ReactNode[];
	scrollRef?: any;
	panelRef?: any;
}

export default function FloatingBarWithContent({
	barContent,
	scrollContent,
	scrollRef,
	panelRef,
	...props
}: PropsWithChildren<FloatingBarWithContentProps>) {
	const scrollContainerRefDefault = React.useRef<HTMLDivElement>(null);
	const scrollContainerRef = scrollRef || scrollContainerRefDefault;
	const [floatRef, { height }] = useMeasure();
	const [topItemRef, topItemInView] = useInView({
		root: scrollContainerRef,
		rootMargin: '-10px 0px 10px 0px'
	});

	const styles = useSpring({ paddingTop: height + 8 });
	const theme = useTheme();

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				overflow: 'hidden',
				border: theme?.border1Base,
				borderRadius: '8px'
				// padding: '8px'
			}}
		>
			<FloatingBarScrollContainer ref={panelRef} {...props}>
				<FloatingBar ref={floatRef} barContent={barContent} float={!topItemInView}></FloatingBar>
				<FloatingBarScrollContent ref={scrollContainerRef} style={styles}>
					{scrollContent?.map((item, index) => (
						<animated.div
							key={index}
							ref={index === 0 ? topItemRef : undefined}
							style={{
								width: '100%',
								height: scrollContent.length === 1 ? '100%' : 'fit-content'
							}}
						>
							{item}
						</animated.div>
					))}
				</FloatingBarScrollContent>
			</FloatingBarScrollContainer>
		</div>
	);
}
