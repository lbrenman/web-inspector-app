import { useCallback, useEffect, useState } from 'react';
import { clearRequests, deleteRequest, describeError, listRequests } from '../api/index.js';

const PAGE_SIZE = 50;
const MAX_ITEMS = 500;

function mergeUnique(existing, incoming) {
  const seen = new Set(existing.map((item) => item.id));
  return [...existing, ...incoming.filter((item) => !seen.has(item.id))];
}

/**
 * Loads the captured-request list and keeps it live through Server-Sent Events.
 * `version` increments on every change so dependent views (patterns) know when to refetch.
 */
export function useRequestStream() {
  const [requests, setRequests] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const page = await listRequests({ limit: PAGE_SIZE });
      setRequests(page.items);
      setHasMore(page.hasMore);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(describeError(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();

    const source = new EventSource('/api/stream');
    let openedBefore = false;

    source.onopen = () => {
      setConnected(true);
      // After a reconnect, refetch to catch anything missed while disconnected.
      if (openedBefore) load();
      openedBefore = true;
    };
    source.onerror = () => setConnected(false);

    source.addEventListener('request', (event) => {
      const item = JSON.parse(event.data);
      setRequests((prev) =>
        prev.some((r) => r.id === item.id) ? prev : [item, ...prev].slice(0, MAX_ITEMS),
      );
      setVersion((v) => v + 1);
    });
    source.addEventListener('deleted', (event) => {
      const { id } = JSON.parse(event.data);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setVersion((v) => v + 1);
    });
    source.addEventListener('cleared', () => {
      setRequests([]);
      setHasMore(false);
      setVersion((v) => v + 1);
    });

    return () => source.close();
  }, [load]);

  const loadMore = useCallback(async () => {
    const last = requests.at(-1);
    if (!last) return;
    const page = await listRequests({ limit: PAGE_SIZE, before: last.id });
    setRequests((prev) => mergeUnique(prev, page.items));
    setHasMore(page.hasMore);
  }, [requests]);

  // The server also pushes these changes over SSE; updating locally keeps the UI correct
  // while the stream is disconnected. Both paths are idempotent.
  const remove = useCallback(async (id) => {
    await deleteRequest(id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setVersion((v) => v + 1);
  }, []);

  const clear = useCallback(async () => {
    await clearRequests();
    setRequests([]);
    setHasMore(false);
    setVersion((v) => v + 1);
  }, []);

  return { requests, hasMore, status, error, connected, version, loadMore, remove, clear };
}
