import { useEffect, useState } from 'react';
import { describeError, getInfo } from './api/index.js';
import Header from './components/Header.jsx';
import PatternsView from './components/PatternsView.jsx';
import RepliesView from './components/RepliesView.jsx';
import RequestDetail from './components/RequestDetail.jsx';
import RequestList from './components/RequestList.jsx';
import { useRequestStream } from './hooks/useRequestStream.js';

export default function App() {
  const stream = useRequestStream();
  const [info, setInfo] = useState(null);
  const [view, setView] = useState('requests');
  const [selectedId, setSelectedId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getInfo()
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch(() => {
        // The capture URL is a convenience; the rest of the UI works without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleClear() {
    setActionError(null);
    try {
      await stream.clear();
      setSelectedId(null);
    } catch (err) {
      setActionError(describeError(err));
    }
  }

  async function handleDelete(id) {
    await stream.remove(id);
    setSelectedId((current) => (current === id ? null : current));
  }

  function handleOpenRequest(id) {
    setSelectedId(id);
    setView('requests');
  }

  return (
    <div className="app">
      <Header
        info={info}
        connected={stream.connected}
        view={view}
        onViewChange={setView}
        onClear={handleClear}
      />
      {actionError && (
        <p role="alert" className="banner">
          {actionError}
        </p>
      )}

      <main className="view">
        {view === 'requests' && stream.status === 'loading' && (
          <div className="state">
            <p>Loading…</p>
          </div>
        )}
        {view === 'requests' && stream.status === 'error' && (
          <div className="state">
            <p role="alert">{stream.error}</p>
          </div>
        )}
        {view === 'requests' && stream.status === 'ready' && (
          <div className="workspace">
            <RequestList
              requests={stream.requests}
              selectedId={selectedId}
              onSelect={setSelectedId}
              hasMore={stream.hasMore}
              onLoadMore={stream.loadMore}
            />
            <RequestDetail id={selectedId} onDelete={handleDelete} />
          </div>
        )}
        {view === 'replies' && <RepliesView />}
        {view === 'patterns' && (
          <PatternsView version={stream.version} onOpenRequest={handleOpenRequest} />
        )}
      </main>
    </div>
  );
}
