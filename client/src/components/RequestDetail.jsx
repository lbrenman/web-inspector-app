import { useEffect, useState } from 'react';
import { describeError, getRequest } from '../api/index.js';
import { formatBytes } from '../format.js';
import BodyViewer from './BodyViewer.jsx';
import Card from './Card.jsx';
import KeyValueTable from './KeyValueTable.jsx';

function Message({ children }) {
  return (
    <section className="detail-pane">
      <div className="state">{children}</div>
    </section>
  );
}

export default function RequestDetail({ id, onDelete }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    if (id === null) return undefined;

    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    setDeleteError(null);

    getRequest(id)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', data: null, error: describeError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    setDeleteError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setDeleteError(describeError(err));
    }
  }

  if (id === null) {
    return <Message>Select a request to inspect it.</Message>;
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return <Message>Loading…</Message>;
  }
  if (state.status === 'error') {
    return (
      <Message>
        <p role="alert">{state.error}</p>
      </Message>
    );
  }

  const { data } = state;
  return (
    <section className="detail-pane">
      <div className="detail-head">
        <div className="detail-row">
          <h2 className="detail-title">
            <span className={`method method-${data.method.toLowerCase()}`}>{data.method}</span>
            <span className="path">
              {data.path}
              {data.queryString ? `?${data.queryString}` : ''}
            </span>
          </h2>
          <button type="button" className="danger" onClick={handleDelete}>
            Delete request
          </button>
        </div>
        <div className="chips">
          <span className="chip">{new Date(data.receivedAt).toLocaleString()}</span>
          <span className="chip">HTTP/{data.httpVersion}</span>
          <span className="chip">from {data.remoteAddress ?? 'unknown'}</span>
          <span className="chip">{formatBytes(data.body.size)}</span>
        </div>
        {deleteError && <p role="alert">{deleteError}</p>}
      </div>

      <div className="detail-content">
        <BodyViewer key={data.id} body={data.body} tables={data.tables} />

        {data.query.length > 0 && (
          <Card title="Query parameters" count={data.query.length}>
            <KeyValueTable items={data.query} label="Query parameters" />
          </Card>
        )}

        <Card title="Headers" count={data.headers.length}>
          <KeyValueTable items={data.headers} label="Headers" />
        </Card>
      </div>
    </section>
  );
}
