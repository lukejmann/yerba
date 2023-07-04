import { animated, useInView, useSpring } from '@react-spring/web';
import React, { PropsWithChildren, ReactNode } from 'react';
import useMeasure from 'react-use-measure';
import styled, { useTheme } from 'styled-components/macro';

const FloatingBarContainer = styled(animated.div)<{ align: 'top' | 'bottom' }>`
	display: flex;
	flex-direction: column;
	align-items: center;

	gap: 0px;

	position: absolute;

	left: 0px;
	right: 0px;
	${({ align }) => `${align}: 0px;`}

	z-index: ${({ align }) => (align === 'top' ? '101' : '100')};

	padding: 12px 8px;

	border-radius: 8px;
`;

interface FloatingBarProps {
	content?: ReactNode;
	align: 'top' | 'bottom';
	float: boolean;
	ref?: any;
}

export const FloatingBar = React.forwardRef<HTMLDivElement, FloatingBarProps>(function FloatingBar(
	{ content, float, align },
	ref
) {
	const theme = useTheme();
	const styles = useSpring({
		boxShadow:
			align == 'bottom'
				? '0px 2px 3px -1px rgba(0, 0, 0, 0.0'
				: float
				? '0px 10px 30px -5px rgba(0, 0, 0, 0.1)'
				: '0px 10px 30px -5px rgba(0, 0, 0, 0.01)',

		backgroundColor:
			align == 'bottom'
				? theme?.backgroundFloatingBase
				: float
				? 'rgba(255, 255, 255, 0.2)'
				: 'rgba(255, 255, 255, 0.025)',
		backdropFilter: float || align == 'bottom' ? 'blur(8px)' : 'blur(0.1px)',

		config: {
			tension: 300
		}
	});

	return (
		<FloatingBarContainer ref={ref} style={styles} align={align}>
			{content}
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

	padding: 12px 28px;
	margin: 0px -20px;
`;

const FloatingBarTotalWrapper = styled(animated.div)`
	width: 100%;
	height: 100%;
	border-radius: 8px;
	margin: 0 -0px;
	padding: 0 0px;
`;

interface FloatingBarWithContentProps {
	topBarContent?: ReactNode;
	onReachTop?: () => void;
	bottomBarContent?: ReactNode;
	scrollContent?: ReactNode[];
	scrollRef?: any;
	panelRef?: any;
	border?: string;
	prefer?: 'top' | 'bottom';
	emptyState?: ReactNode;
}

export default function FloatingBarWithContent({
	topBarContent,
	onReachTop,
	bottomBarContent,
	scrollContent,
	scrollRef,
	panelRef,
	border,
	prefer = 'top',
	emptyState,
	...props
}: PropsWithChildren<FloatingBarWithContentProps>) {
	const scrollContainerRefDefault = React.useRef<HTMLDivElement>(null);
	const scrollContainerRef = scrollRef || scrollContainerRefDefault;
	const [topFloatRef, { height: topHeight }] = useMeasure();
	const [bottomFloatRef, { height: bottomHeight }] = useMeasure();
	const [topItemRef, topItemInView] = useInView({
		root: scrollContainerRef,
		rootMargin: '-10px 0px 10px 0px'
	});
	const [bottomItemRef, bottomItemInView] = useInView({
		root: scrollContainerRef,
		rootMargin: '10px 0px -10px 0px'
	});
	const theme = useTheme();

	const scrollStyles = useSpring({ paddingTop: topHeight + 0, paddingBottom: bottomHeight + 0 });

	const wrapperStyles = useSpring({
		boxShadow:
			!bottomItemInView || !topItemInView
				? '0 0 0 1pt rgba(230, 230, 230, 0.2)'
				: '0 0 0 1pt rgba(230, 230, 230, 0.02)'
	});

	React.useEffect(() => {
		if (topItemInView) {
			onReachTop?.();
		}
	}, [topItemInView]);

	return (
		<FloatingBarTotalWrapper
			style={{
				...wrapperStyles
			}}
		>
			<FloatingBarScrollContainer style={{ background: '' }} ref={panelRef} {...props}>
				<FloatingBar
					ref={topFloatRef}
					content={topBarContent}
					float={!topItemInView}
					align={'top'}
				></FloatingBar>
				<FloatingBarScrollContent ref={scrollContainerRef} style={scrollStyles}>
					{scrollContent?.length ?? 0 > 0 ? (
						scrollContent?.map((item, index) => (
							<animated.div
								key={index}
								ref={
									index === 0
										? topItemRef
										: index === scrollContent.length - 1
										? bottomItemRef
										: null
								}
								style={{
									width: '100%',
									height: scrollContent.length === 1 ? '100%' : 'fit-content'
								}}
							>
								{item}
							</animated.div>
						))
					) : (
						<animated.div
							style={{
								width: '100%',
								height: '100%',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								justifyContent: 'center'
							}}
						>
							{emptyState}
						</animated.div>
					)}
				</FloatingBarScrollContent>
				{bottomBarContent && (
					<FloatingBar
						ref={bottomFloatRef}
						content={bottomBarContent}
						float={!bottomItemInView}
						align={'bottom'}
					></FloatingBar>
				)}
			</FloatingBarScrollContainer>
		</FloatingBarTotalWrapper>
	);
}
