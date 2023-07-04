import { animated, useInView } from '@react-spring/web';
import { ReactNode, Suspense, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Outlet } from 'react-router';
import { useSpring } from 'react-spring';
import { useDrag, useMove, useScroll } from 'react-use-gesture';
import styled from 'styled-components/macro';
import SpacesList from './SpacesList';

export const ContentPanelGroup = styled(animated(PanelGroup))`
	width: 100vw;
	height: 100vh;

	gap: 10px;
	overflow: visible !important;
`;

export const ContentPanel = styled(animated(Panel))`
	overflow: visible !important;
`;

export const ContentPanelResizeHandleWrapper = styled(animated(PanelResizeHandle))<{
	direction: 'vertical' | 'horizontal';
}>`
	display: flex;
	flex-direction: ${({ direction }) => (direction === 'horizontal' ? 'row' : 'column')};
	justify-content: center;
	align-items: center;
	${({ direction }) =>
		direction === 'horizontal'
			? `
			width: 16px;
			height: 100%;
		`
			: `
			width: 100%;
			height: 12px;
		`}

	z-index: 1000;
`;

export const ContentPanelResizeHandleBar = styled(animated.div)<{
	direction: 'vertical' | 'horizontal';
}>`
	background: rgba(24, 42, 77, 0.03);
	box-shadow: -33.766px 25.9738px 77.9215px rgba(0, 0, 0, 0.14);
	backdrop-filter: blur(6.06056px);
	border-radius: 10px;
	width: 100%;
	height: 100%;

	${({ direction }) =>
		direction === 'horizontal'
			? `
		max-height: 220px;
		max-width: 4px;
		transform: translateX(2px);
	`
			: `
		max-width: 120px;
		max-height: 3px;
	`}
`;

export const ContentPanelResizeHandle = ({
	direction,
	...props
}: {
	direction: 'vertical' | 'horizontal';
}) => {
	return (
		<ContentPanelResizeHandleWrapper direction={direction} {...props}>
			<ContentPanelResizeHandleBar direction={direction} />
		</ContentPanelResizeHandleWrapper>
	);
};

const AnimatedContentPanelResizeHandle = animated(ContentPanelResizeHandle);

export const Component = () => {
	const [{ x, leftScale, rightScale, rightY }, api] = useSpring(() => ({
		x: 0,
		leftScale: 1,
		rightScale: 1,
		rightWidth: 50,
		rightY: 0,
		config: { tension: 100, friction: 50, mass: 10 }
	}));
	// const bind = useDrag(({ active, movement: [x] }) =>
	// 	api.start({
	// 		x: active ? x : 0,
	// 		leftScale: active ? 0.999 : 1,
	// 		rightScale: active ? 1.001 : 1,
	// 		rightY: active ? -5 : 0,
	// 		immediate: (name) => active && name === 'x'
	// 	})
	// );

	return (
		<div style={{ width: '100%', height: '100%' }}>
			<ContentPanelGroup autoSaveId="userLayout" direction="horizontal">
				<ContentPanel style={{ scale: leftScale }} minSize={10} defaultSize={14}>
					<SpacesList />
				</ContentPanel>
				<AnimatedContentPanelResizeHandle direction={'horizontal'} />
				<ContentPanel style={{ scale: rightScale, translateY: rightY }}>
					<Suspense>
						<Outlet />
					</Suspense>
				</ContentPanel>
			</ContentPanelGroup>
		</div>
	);
};
