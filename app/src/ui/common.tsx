import React from 'react';
import { ArrowLeft, Copy, ExternalLink as ExternalLinkIconFeather, X } from 'react-feather';
import { Link } from 'react-router-dom';
import { Box } from 'rebass/styled-components';
import styled, { DefaultTheme, css, keyframes } from 'styled-components/macro';

export const CloseIcon = styled(X)<{ onClick: () => void }>`
	color: ${({ theme }) => theme.text2};
	cursor: pointer;
`;

export const IconWrapper = styled.div<{
	stroke?: string;
	size?: string;
	marginRight?: string;
	marginLeft?: string;
}>`
	display: flex;
	align-items: center;
	justify-content: center;
	width: ${({ size }) => size ?? '20px'};
	height: ${({ size }) => size ?? '20px'};
	margin-right: ${({ marginRight }) => marginRight ?? 0};
	margin-left: ${({ marginLeft }) => marginLeft ?? 0};
	& > * {
		stroke: ${({ theme, stroke }) => stroke ?? theme.accentActive};
	}
`;

export const KeystrokeWrapper = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	background: ${({ theme }) => theme.backgroundScrolledSurface};
	padding: 2px 4px;
	color: ${({ theme }) => theme.text4};
	font-size: 12px;
	font-weight: 500;
	width: 12px;
	height: 12px;
	border-radius: 2px;
`;

export const ButtonText = styled.button`
	outline: none;
	border: none;
	font-size: inherit;
	padding: 0;
	margin: 0;
	background: none;
	cursor: pointer;
	transition-duration: ${({ theme }) => theme.transition.duration.fast};
	transition-timing-function: ease-in-out;
	transition-property: opacity, color, background-color;

	:hover {
		opacity: ${({ theme }) => theme.opacity.hover};
	}

	:focus {
		text-decoration: underline;
	}
`;

export const Row = styled(Box)<{
	width?: string;
	align?: string;
	justify?: string;
	padding?: string;
	border?: string;
	borderRadius?: string;
}>`
	width: ${({ width }) => width ?? '100%'};
	display: flex;
	padding: 0;
	align-items: ${({ align }) => align ?? 'center'};
	justify-content: ${({ justify }) => justify ?? 'flex-start'};
	padding: ${({ padding }) => padding};
	border: ${({ border }) => border};
	border-radius: ${({ borderRadius }) => borderRadius};
`;

export const RowBetween = styled(Row)`
	justify-content: space-between;
`;

export const RowFlat = styled.div`
	display: flex;
	align-items: flex-end;
`;

export const AutoRow = styled(Row)<{ gap?: string; justify?: string }>`
	flex-wrap: wrap;
	margin: ${({ gap }) => gap && `-${gap}`};
	justify-content: ${({ justify }) => justify && justify};

	& > * {
		margin: ${({ gap }) => gap} !important;
	}
`;

export const RowFixed = styled(Row)<{ gap?: string; justify?: string }>`
	width: fit-content;
	margin: ${({ gap }) => gap && `-${gap}`};
`;

type Gap = keyof DefaultTheme['grids'];

export const Column = styled.div<{
	gap?: Gap;
}>`
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	gap: ${({ gap, theme }) => gap && theme.grids[gap]};
`;
export const ColumnCenter = styled(Column)`
	width: 100%;
	align-items: center;
`;

export const AutoColumn = styled.div<{
	gap?: Gap | string;
	justify?: 'stretch' | 'center' | 'start' | 'end' | 'flex-start' | 'flex-end' | 'space-between';
}>`
	display: grid;
	grid-auto-rows: auto;
	grid-row-gap: ${({ gap, theme }) => (gap && theme.grids[gap as Gap]) || gap};
	justify-items: ${({ justify }) => justify && justify};
`;
