const request = require('supertest');
const { createCaptureApp } = require('../../src/captureApp');
const { createInspectorApp } = require('../../src/inspectorApp');

const captureApp = createCaptureApp();
const inspectorApp = createInspectorApp();

/** supertest agent for the public capture app (/hook). */
const capture = () => request(captureApp);

/** supertest agent for the private inspector API (/api). */
const api = () => request(inspectorApp);

/** Sends a JSON POST to /hook[path] and returns the recorded request id. */
async function captureJson(payload, path = '/hook') {
  const res = await capture().post(path).send(payload);
  if (res.status !== 200) {
    throw new Error(`Capture failed with ${res.status}: ${res.text}`);
  }
  return res.body.id;
}

module.exports = { captureApp, inspectorApp, capture, api, captureJson };
