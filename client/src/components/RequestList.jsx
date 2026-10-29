import { formatBytes, formatTime, statusClass } from '../format.js';

export default function RequestList({ requests, selectedId, onSelect, hasMore, onLoadMore }) {
  if (requests.length === 0) {
    return (
      <aside className="list-pane">
        <p className="empty">No requests yet. Send one to the capture URL above.</p>
      </aside>
    );
  }

  return (
    <aside className="list-pane">
      <ul>
        {requests.map((request) => {
          const target = `${request.path}${request.queryString ? `?${request.queryString}` : ''}`;
          return (
            <li key={request.id}>
              <button
                type="button"
                className={request.id === selectedId ? 'item selected' : 'item'}
                aria-current={request.id === selectedId ? 'true' : undefined}
                onClick={() => onSelect(request.id)}
              >
                <span className="row1">
                  <span className={`method method-${request.method.toLowerCase()}`}>
                    {request.method}
                  </span>
                  <span className="path" title={target}>
                    {request.path}
                    {request.queryString ? `?${request.queryString}` : ''}
                  </span>
                </span>
                <span className="row2">
                  <span>{formatTime(request.receivedAt)}</span>
                  <span>{formatBytes(request.bodySize)}</span>
                  {request.isJson && <span className="badge">JSON</span>}
                  {request.responseStatus != null && (
                    <span
                      className={`code ${statusClass(request.responseStatus)}`}
                      title="Status of the reply sent"
                    >
                      {request.responseStatus}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <button type="button" className="load-more" onClick={onLoadMore}>
          Load older
        </button>
      )}
    </aside>
  );
}
