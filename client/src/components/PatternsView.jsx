import { useEffect, useState } from 'react';
import { describeError, getPatternTable, listPatterns } from '../api/index.js';
import DataTable from './DataTable.jsx';

export default function PatternsView({ version, onOpenRequest }) {
  const [patterns, setPatterns] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [table, setTable] = useState(null);
  const [tableError, setTableError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listPatterns()
      .then((result) => {
        if (cancelled) return;
        setPatterns(result.patterns);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(describeError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  useEffect(() => {
    if (!selected) return undefined;

    let cancelled = false;
    getPatternTable(selected)
      .then((result) => {
        if (cancelled) return;
        setTable(result);
        setTableError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setTable(null);
        setTableError(describeError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selected, version]);

  if (error) return <p role="alert">{error}</p>;
  if (patterns === null) return <p>Loading…</p>;
  if (patterns.length === 0) {
    return (
      <p className="muted">
        No patterns yet. A pattern appears when two or more JSON-object payloads share the same
        top-level keys.
      </p>
    );
  }

  return (
    <div className="patterns">
      <ul className="pattern-list">
        {patterns.map((pattern) => (
          <li key={pattern.id}>
            <button
              type="button"
              className={pattern.id === selected ? 'item selected' : 'item'}
              aria-current={pattern.id === selected ? 'true' : undefined}
              onClick={() => setSelected(pattern.id)}
            >
              <span className="path">{pattern.keys.join(', ')}</span>
              <span className="meta">
                {pattern.count} requests · last {new Date(pattern.lastSeen).toLocaleTimeString()}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="pattern-table">
        {tableError && <p role="alert">{tableError}</p>}
        {!selected && <p className="muted">Select a pattern to view it as a table.</p>}
        {selected && table && table.id === selected && (
          <>
            <p className="muted">
              {table.totalRows} requests
              {table.rows.length < table.totalRows && ` (showing the newest ${table.rows.length})`}
              {table.columnsTruncated && ', columns truncated'}
            </p>
            <DataTable
              columns={table.columns}
              rows={table.rows}
              leading={{
                header: 'Request',
                cell: (rowIndex) => {
                  const meta = table.rowMeta[rowIndex];
                  return (
                    <button
                      type="button"
                      className="link"
                      aria-label={`Open request ${meta.id}`}
                      onClick={() => onOpenRequest(meta.id)}
                    >
                      #{meta.id}
                    </button>
                  );
                },
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
