// Based mostly on https://github.com/Uniswap/interface/blob/main/src/theme/index.tsx
import { opacify } from './utils';

type Theme = typeof lightTheme;

export const lightTheme = {
	text1: '#4D4D4D',
	text2: '#6E6E6E',
	text3: '#B3B6CA',
	buttonTextBase: '#B3B6CA',
	buttonBackgroundBase: '##FFFFFF',
	border1: '##E6E6E6',
	backgroundFloatingNone: '#rgba(100, 100, 100, 1.00)',
	backgroundFloatingBase: '#rgba(255, 255, 255, 1.02)',
	userMessageBackground: '#027DFF',
	userMessageText: '#FFFFFF',
	otherMessageBackground: '#FFFFFA',
	otherMessageText: '#4D4D4D'
};
