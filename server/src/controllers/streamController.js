const { subscribe } = require('../events/requestEvents');

const HEARTBEAT_MS = 25000;

/** Server-Sent Events: pushes `request`, `deleted` and `cleared` events to the inspector UI. */
function stream(_req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(': connected\n\n');

  const unsubscribe = subscribe(({ type, data }) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  });

  // Comment lines keep idle connections from being closed by proxies.
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  // Use `res`, not `req`: since Node 16 `req` emits 'close' when the request is complete,
  // whereas `res` emits it when the client connection actually goes away.
  res.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

module.exports = { stream };
