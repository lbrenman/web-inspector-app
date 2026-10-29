const config = require('./config');

function error(...args) {
  if (!config.isTest) {
    console.error(...args);
  }
}

module.exports = { error };
