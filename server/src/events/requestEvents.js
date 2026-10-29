const { EventEmitter } = require('node:events');

// In-process pub/sub. The capture app and the inspector API run in the same process, so captures
// can be pushed straight to open SSE connections. (Splitting them into separate processes would
// require Postgres LISTEN/NOTIFY or similar.)
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function publish(type, data) {
  emitter.emit('event', { type, data });
}

function subscribe(listener) {
  emitter.on('event', listener);
  return () => emitter.off('event', listener);
}

module.exports = { publish, subscribe };
