// Pure functions for choosing and rendering the reply sent back to callers of /hook.

const NO_BODY_STATUSES = new Set([204, 205, 304]);

// Used when no rule matches.
const DEFAULT_RULE = Object.freeze({
  name: null,
  status: 200,
  headers: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
  body: '{"received":true,"id":{{id}}}',
  delayMs: 0,
});

/** Lowercases and drops one trailing slash, so /hook/a and /hook/A/ are the same path. */
function normalizePath(path) {
  const lower = path.toLowerCase();
  return lower.length > 1 && lower.endsWith('/') ? lower.slice(0, -1) : lower;
}

function isPrefixPattern(pattern) {
  return pattern !== '*' && pattern.endsWith('*');
}

function matchesPattern(pattern, path) {
  if (pattern === '*') return true;
  if (isPrefixPattern(pattern)) {
    return path.toLowerCase().startsWith(pattern.slice(0, -1).toLowerCase());
  }
  return normalizePath(pattern) === normalizePath(path);
}

/** Exact paths beat prefixes, longer prefixes beat shorter ones, and '*' matches last. */
function specificity(pattern) {
  if (pattern === '*') return 0;
  if (isPrefixPattern(pattern)) return pattern.length;
  return Number.MAX_SAFE_INTEGER;
}

/** Returns the most specific rule matching `path` (lowest id on a tie), or null. */
function selectRule(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (!matchesPattern(rule.pathPattern, path)) continue;
    if (
      best === null ||
      specificity(rule.pathPattern) > specificity(best.pathPattern) ||
      (specificity(rule.pathPattern) === specificity(best.pathPattern) && rule.id < best.id)
    ) {
      best = rule;
    }
  }
  return best;
}

function fill(text, vars) {
  return text.replace(/\{\{\s*(id|timestamp)\s*\}\}/g, (_match, key) => String(vars[key]));
}

function looksLikeJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns a rule (or the default) into the concrete reply: placeholders {{id}} and {{timestamp}}
 * are filled in, Content-Type is defaulted when missing, and Content-Length is added.
 * Returns { status, headers: [[name, value]], body, delayMs, ruleName }.
 */
function renderReply(rule, vars) {
  const source = rule ?? DEFAULT_RULE;
  const hasBody = !NO_BODY_STATUSES.has(source.status);
  const body = hasBody ? fill(source.body, vars) : '';

  const headers = source.headers.map(({ name, value }) => [name, fill(value, vars)]);
  const hasContentType = headers.some(([name]) => name.toLowerCase() === 'content-type');
  if (body !== '' && !hasContentType) {
    headers.push([
      'Content-Type',
      looksLikeJson(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ]);
  }
  if (hasBody) {
    headers.push(['Content-Length', String(Buffer.byteLength(body))]);
  }

  return {
    status: source.status,
    headers,
    body,
    delayMs: source.delayMs,
    ruleName: source.name,
  };
}

module.exports = { DEFAULT_RULE, matchesPattern, selectRule, renderReply };
