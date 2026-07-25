import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

import { DEV_SERVER_PORT, DEV_UI_PORT } from './shared/config.js';

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue()],
	server: {
		host: '127.0.0.1',
		port: DEV_UI_PORT,
		proxy: {
			'/api': `http://127.0.0.1:${DEV_SERVER_PORT}`,
		},
	},
});
