import React, { useMemo } from 'react';
import {
	DefaultTheme,
	ThemeProvider as StyledComponentsThemeProvider,
	createGlobalStyle,
	css
} from 'styled-components/macro';
import { lightTheme } from './colors';

export const MEDIA_WIDTHS = {
	deprecated_upToExtraSmall: 500,
	deprecated_upToSmall: 720,
	deprecated_upToMedium: 960,
	deprecated_upToLarge: 1280
};

const BREAKPOINTS = {
	xs: 396,
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	xxl: 1536,
	xxxl: 1920
};

const transitions = {
	duration: {
		slow: '250ms',
		medium: '125ms',
		fast: '20ms'
	},
	timing: {
		ease: 'ease',
		in: 'ease-in',
		out: 'ease-out',
		inOut: 'ease-in-out'
	}
};

const opacities = {
	hover: 0.6,
	click: 0.4,
	disabled: 0.5,
	enabled: 1
};

const widthsTemplates: { [width in keyof typeof MEDIA_WIDTHS]: typeof css } = Object.keys(
	MEDIA_WIDTHS
).reduce((accumulator, size) => {
	(accumulator as any)[size] = (a: any, b: any, c: any) => css`
		@media (max-width: ${(MEDIA_WIDTHS as any)[size]}px) {
			${css(a, b, c)}
		}
	`;
	return accumulator;
}, {}) as any;

export function getTheme() {
	return {
		...lightTheme,
		...{
			ignoreThisKey: true,
			grids: {
				sm: 8,
				md: 12,
				lg: 24
			},

			shadow1Base: '-39px 30px 90px rgba(0, 0, 0, 0.1)',
			shadow1None: '-13px 10px 30px rgba(0, 0, 0, 0.0)',
			backdrop1Base: 'blur(7px)',
			backdrop1None: 'blur(0px)',
			border1Base: '1px solid #E6E6E6',
			border1Light: '1px solid #e6e6e65d',
			border1None: '0px solid #E6E6E6',
			border2Base: '2px solid #E6E6E6',
			border2None: '2px solid #E6E6E6',

			widths: widthsTemplates,

			transition: transitions,
			opacity: opacities
		}
	};
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const themeObject: DefaultTheme = useMemo(() => getTheme(), []);
	return (
		<StyledComponentsThemeProvider theme={themeObject}>{children}</StyledComponentsThemeProvider>
	);
}

export const ThemedGlobalStyle = createGlobalStyle`
html {
font-family: 'Satoshi', Helvetica, Arial, sans-serif;
backface-visibility: hidden;
// transform: translateZ(0);
// -webkit-font-smoothing: subpixel-antialiased;
text-rendering: optimizeLegibility;
text-shadow: rgba(0, 0, 0, 0.01) 0 0 1px;
}
a {
 color: ${({ theme }) => theme.blue}; 
}
`;
