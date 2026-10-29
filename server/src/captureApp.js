const express = require('express');
const captureRoutes = require('./routes/capture');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

/**
 * The only app meant to be reachable by outside callers (e.g. Postman via a Public Codespaces
 * port). It serves /hook and nothing else, so exposing it does not expose stored data.
 */
function createCaptureApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(captureRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createCaptureApp };
