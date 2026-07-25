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

const shutdown = async () => {
	await app.close();
	process.exit(0);
};

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
