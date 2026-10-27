import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createApp } from './app.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const config = loadConfig();
const pool = createPool(config);
let vite = null;
let frontendMiddleware = null;
let staticDirectory = null;

if (config.environment === 'production') {
  staticDirectory = path.join(projectRoot, 'apps', 'web', 'dist');
} else {
  const { createServer } = await import('vite');
  const webRoot = path.join(projectRoot, 'apps', 'web');
  const configModule = await import(pathToFileURL(path.join(webRoot, 'vite.config.js')).href);
  const userConfig = typeof configModule.default === 'function'
    ? await configModule.default({ mode: config.environment, command: 'serve' })
    : configModule.default;
  vite = await createServer({
    ...userConfig,
    configFile: false,
    root: webRoot,
    appType: 'spa',
    server: {
      ...(userConfig?.server || {}),
      middlewareMode: true,
      hmr: false,
    },
  });
  frontendMiddleware = vite.middlewares;
}

const app = createApp({ pool, config, frontendMiddleware, staticDirectory });
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`LabTrack web service listening on port ${config.port} (${config.environment}).`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}; closing LabTrack.`);
  server.close(async () => {
    await vite?.close();
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
