import { useMemo } from 'react';
import { z } from 'zod';
import { useZodSearchParams } from '~/hooks';

export const SEARCH_PARAMS = z.object({
	path: z.string().optional(),
	take: z.coerce.number().default(100)
});

export function useSpaceParams() {
	return useZodSearchParams(SEARCH_PARAMS);
}

export function getLastSectionOfPath(path: string): string | undefined {
	if (path.endsWith('/')) {
		path = path.slice(0, -1);
	}
	const sections = path.split('/');
	const lastSection = sections[sections.length - 1];
	return lastSection;
}
