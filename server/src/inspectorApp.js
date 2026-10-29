const express = require('express');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

/** Read/manage API for the inspector UI. Keep its port Private. */
function createInspectorApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createInspectorApp };
