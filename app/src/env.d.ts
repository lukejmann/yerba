/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SERVER_BASE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
