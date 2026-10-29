exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('requests', {
    id: 'id',
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    method: { type: 'varchar(32)', notNull: true },
    path: { type: 'text', notNull: true },
    query_string: { type: 'text', notNull: true, default: '' },
    // Ordered array of [name, value] pairs, exactly as received (case, order, duplicates).
    headers: { type: 'jsonb', notNull: true },
    remote_address: { type: 'text' },
    http_version: { type: 'varchar(8)' },
    content_type: { type: 'text' },
    // The untouched request body bytes.
    body_raw: { type: 'bytea', notNull: true },
    body_size: { type: 'integer', notNull: true },
    // Parsed body, only when it is valid JSON that jsonb can store.
    body_json: { type: 'jsonb' },
    // For JSON-object bodies: hash of the sorted top-level keys, used to group similar payloads.
    shape_hash: { type: 'varchar(40)' },
    shape_keys: { type: 'text[]' },
  });
  pgm.createIndex('requests', 'shape_hash', { where: 'shape_hash IS NOT NULL' });
};

exports.down = (pgm) => {
  pgm.dropTable('requests');
};
