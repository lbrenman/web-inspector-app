let config;
try {
  config = require('./config');
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

const { createApp } = require('./app');
const { pool } = require('./db/pool');

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port} (${config.env})`);
});

server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (err) {
      console.error('Error while closing the database pool:', err.message);
      process.exit(1);
    }
  });

  // Force exit if open connections keep the server from closing.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
  process.exit(1);
});
