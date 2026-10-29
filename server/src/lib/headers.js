/** Converts Node's flat `rawHeaders` array into ordered [name, value] pairs (case and duplicates kept). */
function pairHeaders(rawHeaders) {
  const pairs = [];
  for (let i = 0; i + 1 < rawHeaders.length; i += 2) {
    pairs.push([rawHeaders[i], rawHeaders[i + 1]]);
  }
  return pairs;
}

/** Case-insensitive lookup of the first header with the given name. */
function findHeader(pairs, name) {
  const lower = name.toLowerCase();
  const match = pairs.find(([key]) => key.toLowerCase() === lower);
  return match ? match[1] : undefined;
}

module.exports = { pairHeaders, findHeader };
