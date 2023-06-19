import React from 'react';
import { UAParser } from 'ua-parser-js';

const parser = new UAParser(window.navigator.userAgent);
const { type } = parser.getDevice();
export const isMobile = type === 'mobile' || type === 'tablet';

export function opacify(amount: number, hexColor: string): string {
	if (!hexColor.startsWith('#')) {
		return hexColor;
	}

	if (hexColor.length !== 7) {
		throw new Error(
			`opacify: provided color ${hexColor} was not in hexadecimal format (e.g. #000000)`
		);
	}

	if (amount < 0 || amount > 100) {
		throw new Error('opacify: provided amount should be between 0 and 100');
	}

	const opacityHex = Math.round((amount / 100) * 255).toString(16);
	const opacifySuffix = opacityHex.length < 2 ? `0${opacityHex}` : opacityHex;

	return `${hexColor.slice(0, 7)}${opacifySuffix}`;
}

export enum Z_INDEX {
	deprecated_zero = 0,
	deprecated_content = 1,
	dropdown = 1000,
	sticky = 1020,
	fixed = 1030,
	modalBackdrop = 1040,
	offcanvas = 1050,
	modal = 1060,
	popover = 1070,
	tooltip = 1080
}
