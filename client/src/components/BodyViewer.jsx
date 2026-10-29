import { useState } from 'react';
import Card from './Card.jsx';
import DataTable from './DataTable.jsx';

// Highlighting creates one element per token, so skip it for very large bodies.
const MAX_HIGHLIGHT_LENGTH = 200_000;

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

function tokenClass(token) {
  if (token === 'null') return 'tok-null';
  if (token === 'true' || token === 'false') return 'tok-bool';
  return 'tok-number';
}

function highlightJson(text) {
  if (text.length > MAX_HIGHLIGHT_LENGTH) return text;

  const nodes = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const [token, string, colon] = match;
    if (match.index > last) nodes.push(text.slice(last, match.index));

    if (string === undefined) {
      nodes.push(
        <span key={key++} className={tokenClass(token)}>
          {token}
        </span>,
      );
    } else if (colon) {
      nodes.push(
        <span key={key++} className="tok-key">
          {string}
        </span>,
        colon,
      );
    } else {
      nodes.push(
        <span key={key++} className="tok-string">
          {string}
        </span>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function prettyJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function formatBytes(size) {
  return size === 1 ? '1 byte' : `${size} bytes`;
}

export default function BodyViewer({ body, tables, title = 'Body' }) {
  const hasTables = tables.length > 0;
  const tabs = [
    ...(body.isJson ? [{ id: 'pretty', label: 'Pretty' }] : []),
    { id: 'raw', label: 'Raw' },
    ...(hasTables ? [{ id: 'tables', label: `Tables (${tables.length})` }] : []),
  ];
  const [selected, setSelected] = useState(body.isJson ? 'pretty' : 'raw');
  const active = tabs.some((tab) => tab.id === selected) ? selected : tabs[0].id;
  const isEmpty = body.encoding === 'empty';

  const tabList = isEmpty ? null : (
    <div role="tablist" aria-label="Body view" className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => setSelected(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <Card title={title} actions={tabList}>
      {isEmpty && <p className="empty">No body.</p>}

      {body.encoding === 'base64' && active === 'raw' && (
        <>
          <p className="note">Binary body ({formatBytes(body.size)}), shown as base64.</p>
          <pre>{body.base64}</pre>
        </>
      )}
      {body.encoding === 'utf8' && active === 'raw' && <pre>{body.text}</pre>}
      {body.encoding === 'utf8' && active === 'pretty' && (
        <pre aria-label={`${title} (pretty JSON)`}>{highlightJson(prettyJson(body.text))}</pre>
      )}

      {active === 'tables' &&
        tables.map((table) => (
          <section key={table.path} className="table-block">
            <h4>
              <code>{table.path}</code>{' '}
              <span className="muted">
                {table.totalRows} rows
                {table.rows.length < table.totalRows && ` (showing ${table.rows.length})`}
                {table.columnsTruncated && ', columns truncated'}
              </span>
            </h4>
            <DataTable columns={table.columns} rows={table.rows} className="compact" />
          </section>
        ))}
    </Card>
  );
}
