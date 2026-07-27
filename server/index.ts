#!/usr/bin/env node

import open from 'open';

import { createApp } from './app.js';
import { DEV_SERVER_PORT, DEV_UI_PORT } from '../shared/config.js';

const development = process.argv.includes('--dev');
const app = await createApp({ development });
const address = await app.listen({
	host: '127.0.0.1',
	port: development ? DEV_SERVER_PORT : Number(process.env.SCRIBES_UI_PORT ?? DEV_SERVER_PORT),
});

if (development) {
	console.log(`The API server is available at ${address}`);
	console.log(`The Blue Scribes UI is available at http://127.0.0.1:${DEV_UI_PORT}`);
} else {
	console.log(`The Blue Scribes UI is available at ${address}`);
}

if (!development && process.env.SCRIBES_UI_OPEN !== '0') {
	await open(address);
}

let shutdownPromise: Promise<void> | undefined;
const shutdown = (): Promise<void> => {
	shutdownPromise ??= (async () => {
		const forceClose = setTimeout(() => {
			app.server.closeAllConnections();
		}, 2_000);
		const forceExit = setTimeout(() => {
			console.error('The UI server did not stop cleanly; forcing it to exit.');
			process.exit(1);
		}, 5_000);
		forceClose.unref();
		forceExit.unref();
		try {
			await app.close();
			clearTimeout(forceClose);
		} catch (error: unknown) {
			console.error(error);
			process.exitCode = 1;
		}
	})();
	return shutdownPromise;
};

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
