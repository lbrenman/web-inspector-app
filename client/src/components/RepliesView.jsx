import { useCallback, useEffect, useState } from 'react';
import {
  createReplyRule,
  deleteReplyRule,
  describeError,
  listReplyRules,
  updateReplyRule,
} from '../api/index.js';
import { statusClass } from '../format.js';
import Card from './Card.jsx';

const NEW_DRAFT = {
  name: '',
  pathPattern: '/hook/',
  status: '200',
  delayMs: '0',
  headers: [{ name: 'Content-Type', value: 'application/json' }],
  body: '',
};

function toDraft(rule) {
  return {
    name: rule.name,
    pathPattern: rule.pathPattern,
    status: String(rule.status),
    delayMs: String(rule.delayMs),
    headers: rule.headers.map((header) => ({ ...header })),
    body: rule.body,
  };
}

function toPayload(draft) {
  return {
    name: draft.name,
    pathPattern: draft.pathPattern,
    status: Number(draft.status),
    delayMs: Number(draft.delayMs),
    // Rows left completely blank are ignored.
    headers: draft.headers
      .filter((header) => header.name.trim() !== '' || header.value !== '')
      .map((header) => ({ name: header.name.trim(), value: header.value })),
    body: draft.body,
  };
}

function Overview() {
  return (
    <Card title="How replies work">
      <div className="prose">
        <p>
          Every request to <code>/hook</code> is answered with a reply. Select a rule to edit it, or
          create a new one.
        </p>
        <ul>
          <li>
            A rule matches a path pattern: an exact path (<code>/hook/orders/42</code>), a prefix
            ending in <code>*</code> (<code>/hook/orders*</code>), or <code>*</code> for everything.
          </li>
          <li>The most specific match wins: exact, then the longest prefix, then *.</li>
          <li>
            Without a matching rule the reply is <code>200</code> with{' '}
            <code>{'{"received":true,"id":<id>}'}</code>.
          </li>
          <li>
            Bodies and header values can use <code>{'{{id}}'}</code> (the request id) and{' '}
            <code>{'{{timestamp}}'}</code> (ISO time).
          </li>
          <li>Delay holds only the caller&apos;s connection; the request shows up immediately.</li>
        </ul>
      </div>
    </Card>
  );
}

export default function RepliesView() {
  const [rules, setRules] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null); // null | 'new' | rule id
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await listReplyRules();
      setRules(result.rules);
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function select(rule) {
    setSelectedId(rule.id);
    setDraft(toDraft(rule));
    setFormError(null);
  }

  function startNew() {
    setSelectedId('new');
    setDraft({ ...NEW_DRAFT, headers: NEW_DRAFT.headers.map((header) => ({ ...header })) });
    setFormError(null);
  }

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function setHeader(index, field, value) {
    setDraft((current) => ({
      ...current,
      headers: current.headers.map((header, i) =>
        i === index ? { ...header, [field]: value } : header,
      ),
    }));
  }

  function addHeader() {
    setDraft((current) => ({ ...current, headers: [...current.headers, { name: '', value: '' }] }));
  }

  function removeHeader(index) {
    setDraft((current) => ({
      ...current,
      headers: current.headers.filter((_header, i) => i !== index),
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(draft);
      const saved =
        selectedId === 'new'
          ? await createReplyRule(payload)
          : await updateReplyRule(selectedId, payload);
      await load();
      setSelectedId(saved.id);
      setDraft(toDraft(saved));
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setFormError(null);
    try {
      await deleteReplyRule(selectedId);
      setSelectedId(null);
      setDraft(null);
      await load();
    } catch (err) {
      setFormError(describeError(err));
    }
  }

  if (error) {
    return (
      <div className="state">
        <p role="alert">{error}</p>
      </div>
    );
  }
  if (rules === null) {
    return (
      <div className="state">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="replies">
      <aside className="list-pane">
        <button type="button" className="block-button" onClick={startNew}>
          New rule
        </button>
        {rules.length === 0 ? (
          <p className="empty">No rules. Every request gets the default reply.</p>
        ) : (
          <ul>
            {rules.map((rule) => (
              <li key={rule.id}>
                <button
                  type="button"
                  className={rule.id === selectedId ? 'item selected' : 'item'}
                  aria-current={rule.id === selectedId ? 'true' : undefined}
                  onClick={() => select(rule)}
                >
                  <span className="row1">
                    <span className={`code ${statusClass(rule.status)}`}>{rule.status}</span>
                    <span className="path" title={rule.pathPattern}>
                      {rule.pathPattern}
                    </span>
                  </span>
                  <span className="row2">
                    <span>{rule.name}</span>
                    {rule.delayMs > 0 && <span>{rule.delayMs} ms delay</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="replies-main">
        {!draft && <Overview />}
        {draft && (
          <Card title={selectedId === 'new' ? 'New rule' : 'Edit rule'}>
            <form className="form" onSubmit={handleSave}>
              <label>
                Name
                <input
                  value={draft.name}
                  maxLength={100}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </label>
              <label>
                Path pattern
                <input
                  value={draft.pathPattern}
                  maxLength={500}
                  spellCheck={false}
                  onChange={(e) => setField('pathPattern', e.target.value)}
                />
              </label>
              <div className="form-row">
                <label>
                  Status
                  <input
                    value={draft.status}
                    inputMode="numeric"
                    onChange={(e) => setField('status', e.target.value)}
                  />
                </label>
                <label>
                  Delay (ms)
                  <input
                    value={draft.delayMs}
                    inputMode="numeric"
                    onChange={(e) => setField('delayMs', e.target.value)}
                  />
                </label>
              </div>

              <fieldset>
                <legend>Headers</legend>
                {draft.headers.map((header, index) => (
                  <div className="header-row" key={index}>
                    <input
                      aria-label={`Header name ${index + 1}`}
                      placeholder="Name"
                      value={header.name}
                      spellCheck={false}
                      onChange={(e) => setHeader(index, 'name', e.target.value)}
                    />
                    <input
                      aria-label={`Header value ${index + 1}`}
                      placeholder="Value"
                      value={header.value}
                      spellCheck={false}
                      onChange={(e) => setHeader(index, 'value', e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label={`Remove header ${index + 1}`}
                      onClick={() => removeHeader(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addHeader}>
                  Add header
                </button>
              </fieldset>

              <label>
                Body
                <textarea
                  value={draft.body}
                  rows={6}
                  spellCheck={false}
                  onChange={(e) => setField('body', e.target.value)}
                />
              </label>

              {formError && <p role="alert">{formError}</p>}

              <div className="form-actions">
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save rule'}
                </button>
                {selectedId !== 'new' && (
                  <button type="button" className="danger" onClick={handleDelete}>
                    Delete rule
                  </button>
                )}
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
