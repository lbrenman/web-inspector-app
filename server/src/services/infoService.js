const config = require('../config');

function resolveCaptureBaseUrl() {
  if (config.capturePublicUrl) return config.capturePublicUrl;

  // GitHub Codespaces exposes the forwarded-port URL pieces as environment variables.
  const codespace = process.env.CODESPACE_NAME;
  if (codespace) {
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? 'app.github.dev';
    return `https://${codespace}-${config.capturePort}.${domain}`;
  }

  return `http://localhost:${config.capturePort}`;
}

function getInfo() {
  return {
    captureUrl: `${resolveCaptureBaseUrl()}/hook`,
    maxBodyBytes: config.maxBodyBytes,
    maxStoredRequests: config.maxStoredRequests,
  };
}

module.exports = { getInfo };
