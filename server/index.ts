#!/usr/bin/env node

import open from 'open';

import { createApp } from './app.js';

const development = process.argv.includes('--dev');
const app = await createApp({ development });
const address = await app.listen({
	host: '127.0.0.1',
	port: development ? 43_110 : Number(process.env.SCRIBES_UI_PORT ?? 0),
});

console.log(`The Blue Scribes UI is available at ${address}`);

if (!development && process.env.SCRIBES_UI_OPEN !== '0') {
	await open(address);
}

const shutdown = async () => {
	await app.close();
	process.exit(0);
};

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
