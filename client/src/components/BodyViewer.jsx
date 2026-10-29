import { useState } from 'react';
import DataTable from './DataTable.jsx';

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

export default function BodyViewer({ body, tables }) {
  const hasTables = tables.length > 0;
  const tabs = [
    ...(body.isJson ? [{ id: 'pretty', label: 'Pretty' }] : []),
    { id: 'raw', label: 'Raw' },
    ...(hasTables ? [{ id: 'tables', label: `Tables (${tables.length})` }] : []),
  ];
  const [selected, setSelected] = useState(body.isJson ? 'pretty' : 'raw');
  const active = tabs.some((tab) => tab.id === selected) ? selected : tabs[0].id;

  if (body.encoding === 'empty') {
    return <p className="muted">No body.</p>;
  }

  return (
    <div>
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

      {body.encoding === 'base64' && active === 'raw' && (
        <>
          <p className="muted">Binary body ({formatBytes(body.size)}), shown as base64.</p>
          <pre>{body.base64}</pre>
        </>
      )}
      {body.encoding === 'utf8' && active === 'raw' && <pre>{body.text}</pre>}
      {body.encoding === 'utf8' && active === 'pretty' && <pre>{prettyJson(body.text)}</pre>}

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
            <DataTable columns={table.columns} rows={table.rows} />
          </section>
        ))}
    </div>
  );
}
