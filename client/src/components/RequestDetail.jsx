import { useEffect, useState } from 'react';
import { describeError, getRequest } from '../api/index.js';
import { formatBytes, statusClass, statusText } from '../format.js';
import BodyViewer from './BodyViewer.jsx';
import Card from './Card.jsx';
import KeyValueTable from './KeyValueTable.jsx';

const VIEWS = [
  { id: 'request', label: 'Request' },
  { id: 'response', label: 'Response' },
  { id: 'both', label: 'Both' },
];

function Message({ children }) {
  return (
    <section className="detail-pane">
      <div className="state">{children}</div>
    </section>
  );
}

function RequestSection({ data }) {
  return (
    <div className="column">
      <p className="section-label">Request</p>
      <BodyViewer title="Request body" body={data.body} tables={data.tables} />
      {data.query.length > 0 && (
        <Card title="Query parameters" count={data.query.length}>
          <KeyValueTable items={data.query} label="Query parameters" />
        </Card>
      )}
      <Card title="Request headers" count={data.headers.length}>
        <KeyValueTable items={data.headers} label="Request headers" />
      </Card>
    </div>
  );
}

function ResponseSection({ response }) {
  if (!response) {
    return (
      <div className="column">
        <p className="section-label">Response</p>
        <Card title="Response">
          <p className="empty">No reply was recorded for this request.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="column">
      <p className="section-label">Response</p>
      <Card title="Reply sent">
        <div className="reply-summary">
          <span className={`status-code ${statusClass(response.status)}`}>{response.status}</span>
          <span>{statusText(response.status)}</span>
          <dl className="facts">
            <div>
              <dt>Rule</dt>
              <dd>{response.rule ?? 'Default reply'}</dd>
            </div>
            <div>
              <dt>Delay</dt>
              <dd>{response.delayMs} ms</dd>
            </div>
          </dl>
        </div>
      </Card>
      <BodyViewer title="Response body" body={response.body} tables={[]} />
      <Card title="Response headers" count={response.headers.length}>
        <KeyValueTable items={response.headers} label="Response headers" />
      </Card>
    </div>
  );
}

export default function RequestDetail({ id, onDelete }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [deleteError, setDeleteError] = useState(null);
  const [view, setView] = useState('both');

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
  const response = data.response ?? null;

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
          {response && (
            <span className={`chip code ${statusClass(response.status)}`}>
              Replied {response.status} {statusText(response.status)}
            </span>
          )}
        </div>
        <div role="tablist" aria-label="Detail view" className="tabs">
          {VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={view === option.id}
              onClick={() => setView(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {deleteError && <p role="alert">{deleteError}</p>}
      </div>

      <div className={view === 'both' ? 'detail-content both' : 'detail-content'}>
        {view !== 'response' && <RequestSection key={`request-${data.id}`} data={data} />}
        {view !== 'request' && <ResponseSection key={`response-${data.id}`} response={response} />}
      </div>
    </section>
  );
}
