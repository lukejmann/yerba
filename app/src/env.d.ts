/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SERVE_BASE: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
