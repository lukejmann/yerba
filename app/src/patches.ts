import { wsBatchLink } from '@rspc/client/v2';

const serverOrigin = import.meta.env.DEV ? 'localhost:8080' : import.meta.env.VITE_SERVER_BASE;
const http = import.meta.env.DEV ? 'http' : 'https';

globalThis.isDev = import.meta.env.DEV;
globalThis.rspcLinks = [
	wsBatchLink({
		url: `ws://${serverOrigin}/rspc/ws`
	})
];
globalThis.serverOrigin = serverOrigin;
globalThis.http = http;
