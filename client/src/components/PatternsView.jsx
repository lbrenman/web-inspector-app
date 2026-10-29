import { useEffect, useState } from 'react';
import { describeError, getPatternTable, listPatterns } from '../api/index.js';
import { formatTime } from '../format.js';
import Card from './Card.jsx';
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

  if (error) {
    return (
      <div className="state">
        <p role="alert">{error}</p>
      </div>
    );
  }
  if (patterns === null) {
    return (
      <div className="state">
        <p>Loading…</p>
      </div>
    );
  }
  if (patterns.length === 0) {
    return (
      <div className="state">
        <p>
          No patterns yet. A pattern appears when two or more JSON-object payloads share the same
          top-level keys.
        </p>
      </div>
    );
  }

  const tableNotes =
    table && table.id === selected ? (
      <span className="muted small">
        {table.totalRows} requests
        {table.rows.length < table.totalRows && ` (showing the newest ${table.rows.length})`}
        {table.columnsTruncated && ', columns truncated'}
      </span>
    ) : null;

  return (
    <div className="patterns">
      <aside className="list-pane">
        <ul>
          {patterns.map((pattern) => (
            <li key={pattern.id}>
              <button
                type="button"
                className={pattern.id === selected ? 'item selected' : 'item'}
                aria-current={pattern.id === selected ? 'true' : undefined}
                onClick={() => setSelected(pattern.id)}
              >
                <span className="row1">
                  <span className="path pattern-keys">{pattern.keys.join(', ')}</span>
                </span>
                <span className="row2">
                  <span>{pattern.count} requests</span>
                  <span>last {formatTime(pattern.lastSeen)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="patterns-main">
        {tableError && <p role="alert">{tableError}</p>}
        {!selected && (
          <div className="state">
            <p>Select a pattern to view it as a table.</p>
          </div>
        )}
        {selected && table && table.id === selected && (
          <Card title="Pattern table" actions={tableNotes} className="fill" bodyClassName="fill">
            <DataTable
              columns={table.columns}
              rows={table.rows}
              className="fill"
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
          </Card>
        )}
      </div>
    </div>
  );
}
