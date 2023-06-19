/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly SERVER_BASE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
