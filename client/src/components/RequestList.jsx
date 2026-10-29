function formatTime(value) {
  return new Date(value).toLocaleTimeString();
}

export default function RequestList({ requests, selectedId, onSelect, hasMore, onLoadMore }) {
  if (requests.length === 0) {
    return (
      <aside className="list">
        <p className="muted">No requests yet. Send one to the capture URL above.</p>
      </aside>
    );
  }

  return (
    <aside className="list">
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <button
              type="button"
              className={request.id === selectedId ? 'item selected' : 'item'}
              aria-current={request.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(request.id)}
            >
              <span className={`method method-${request.method.toLowerCase()}`}>
                {request.method}
              </span>
              <span className="path">
                {request.path}
                {request.queryString ? `?${request.queryString}` : ''}
              </span>
              <span className="meta">
                {formatTime(request.receivedAt)} · {request.bodySize} B
                {request.isJson ? ' · JSON' : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button type="button" onClick={onLoadMore}>
          Load older
        </button>
      )}
    </aside>
  );
}
