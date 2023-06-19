import { visualizer } from 'rollup-plugin-visualizer';
import { mergeConfig } from 'vite';
import macrosPlugin from 'vite-plugin-babel-macros';
import baseConfig from './config/vite';

export default mergeConfig(baseConfig, {
	server: {
		port: 8002
	},
	plugins: [
		macrosPlugin(),
		visualizer({
			gzipSize: true,
			brotliSize: true
		})
	]
});
