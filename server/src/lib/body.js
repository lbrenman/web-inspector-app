const decoder = new TextDecoder('utf-8', { fatal: true });

/** Returns the buffer as a string if it is valid UTF-8 without NUL bytes, otherwise null. */
function decodeText(buffer) {
  try {
    const text = decoder.decode(buffer);
    return text.includes('\u0000') ? null : text;
  } catch {
    return null;
  }
}

function parseJson(text, contentType) {
  const looksLikeJson = /json/i.test(contentType ?? '') || /^\s*[[{]/.test(text);
  if (!looksLikeJson) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * Classifies a request body.
 * Returns { encoding: 'empty' | 'utf8' | 'base64', size, text?, base64?, isJson, value? }.
 * `value` (the parsed JSON) is for server-side use and must not be sent to clients as-is.
 */
function analyzeBody(buffer, contentType) {
  if (buffer.length === 0) {
    return { encoding: 'empty', size: 0, text: '', isJson: false };
  }

  const text = decodeText(buffer);
  if (text === null) {
    return { encoding: 'base64', size: buffer.length, base64: buffer.toString('base64'), isJson: false };
  }

  const parsed = parseJson(text, contentType);
  return {
    encoding: 'utf8',
    size: buffer.length,
    text,
    isJson: parsed.ok,
    value: parsed.ok ? parsed.value : undefined,
  };
}

module.exports = { analyzeBody };
