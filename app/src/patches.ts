import { wsBatchLink } from '@rspc/client/v2';

const serverOrigin = import.meta.env.SERVER_BASE || 'localhost:8080';

globalThis.isDev = import.meta.env.DEV;
globalThis.rspcLinks = [
	wsBatchLink({
		url: `ws://${serverOrigin}/rspc/ws`
	})
];
