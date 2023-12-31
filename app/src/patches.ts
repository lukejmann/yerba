import { wsBatchLink } from '@rspc/client/v2';

const serverOrigin = import.meta.env.DEV ? 'localhost:8080' : 'yerba-dev.fly.dev';
const http = import.meta.env.DEV ? 'http' : 'https';
const ws = import.meta.env.DEV ? 'ws' : 'wss';

globalThis.isDev = import.meta.env.DEV;
globalThis.rspcLinks = [
	wsBatchLink({
		url: `${ws}://${serverOrigin}/rspc/ws`
	})
];
globalThis.serverOrigin = serverOrigin;
globalThis.http = http;
