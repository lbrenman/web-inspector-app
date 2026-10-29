import { useEffect, useState } from 'react';
import { describeError, getRequest } from '../api/index.js';
import BodyViewer from './BodyViewer.jsx';
import KeyValueTable from './KeyValueTable.jsx';

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
    return (
      <section className="detail">
        <p className="muted">Select a request to inspect it.</p>
      </section>
    );
  }
  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <section className="detail">
        <p>Loading…</p>
      </section>
    );
  }
  if (state.status === 'error') {
    return (
      <section className="detail">
        <p role="alert">{state.error}</p>
      </section>
    );
  }

  const { data } = state;
  return (
    <section className="detail">
      <h2>
        <span className={`method method-${data.method.toLowerCase()}`}>{data.method}</span>{' '}
        <span className="path">
          {data.path}
          {data.queryString ? `?${data.queryString}` : ''}
        </span>
      </h2>
      <p className="muted">
        Received {new Date(data.receivedAt).toLocaleString()} · HTTP/{data.httpVersion} · from{' '}
        {data.remoteAddress ?? 'unknown'} · {data.body.size} B
      </p>
      <button type="button" onClick={handleDelete}>
        Delete request
      </button>
      {deleteError && <p role="alert">{deleteError}</p>}

      <h3>Headers</h3>
      <KeyValueTable items={data.headers} label="Headers" />

      {data.query.length > 0 && (
        <>
          <h3>Query parameters</h3>
          <KeyValueTable items={data.query} label="Query parameters" />
        </>
      )}

      <h3>Body</h3>
      <BodyViewer key={data.id} body={data.body} tables={data.tables} />
    </section>
  );
}
