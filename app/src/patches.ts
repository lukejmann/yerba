import { wsBatchLink } from '@rspc/client/v2';

const serverOrigin = import.meta.env.VITE_SERVER_BASE || 'localhost:8080';
const http = import.meta.env.DEV ? 'http' : 'https';

// console.log('serverOrigin in patches', serverOrigin);
// console.log('import.meta.env.VITE_SERVER_BASE in patches', import.meta.env.VITE_SERVER_BASE);

globalThis.isDev = import.meta.env.DEV;
globalThis.rspcLinks = [
	wsBatchLink({
		url: `ws://${serverOrigin}/rspc/ws`
	})
];
globalThis.serverOrigin = serverOrigin;
globalThis.http = http;
