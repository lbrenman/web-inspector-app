let config;
try {
  config = require('./config');
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

const { createCaptureApp } = require('./captureApp');
const { createInspectorApp } = require('./inspectorApp');
const { pool } = require('./db/pool');

function listen(app, port, label) {
  const server = app.listen(port, config.host, () => {
    console.log(`${label} listening on http://${config.host}:${port} (${config.env})`);
  });
  server.on('error', (err) => {
    console.error(`${label} error: ${err.message}`);
    process.exit(1);
  });
  return server;
}

const captureServer = listen(createCaptureApp(), config.capturePort, 'Capture endpoint');
const apiServer = listen(createInspectorApp(), config.apiPort, 'Inspector API');
const servers = [captureServer, apiServer];

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
    // Long-lived SSE connections would otherwise keep the server open forever.
    server.closeAllConnections();
  });
}

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Force exit if something refuses to close.
  setTimeout(() => process.exit(1), 10_000).unref();

  try {
    await Promise.all(servers.map(closeServer));
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});
