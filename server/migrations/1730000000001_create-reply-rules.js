exports.shorthands = undefined;

exports.up = (pgm) => {
  // The reply that was actually sent for each captured request.
  pgm.addColumns('requests', {
    response_status: { type: 'smallint' },
    // Ordered array of [name, value] pairs, like the request headers.
    response_headers: { type: 'jsonb' },
    response_body: { type: 'text' },
    response_rule: { type: 'varchar(100)' },
    response_delay_ms: { type: 'integer' },
  });

  // Optional, user-defined replies. The most specific matching path pattern wins.
  pgm.createTable('reply_rules', {
    id: 'id',
    name: { type: 'varchar(100)', notNull: true },
    // '*' (everything), an exact path, or a prefix ending in '*', e.g. '/hook/services/collector*'.
    path_pattern: { type: 'varchar(500)', notNull: true },
    status: { type: 'smallint', notNull: true },
    // Array of { name, value } objects.
    headers: { type: 'jsonb', notNull: true, default: pgm.func(`'[]'::jsonb`) },
    body: { type: 'text', notNull: true, default: '' },
    delay_ms: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.sql(
    'CREATE UNIQUE INDEX reply_rules_path_pattern_lower_idx ON reply_rules (lower(path_pattern))',
  );

  // Default rule for Splunk HTTP Event Collector senders, which expect this exact reply.
  // The body is assembled with chr() so node-pg-migrate's {placeholder} templating never sees braces.
  pgm.sql(`
    INSERT INTO reply_rules (name, path_pattern, status, headers, body)
    VALUES (
      'Splunk HEC',
      '/hook/services/collector*',
      200,
      jsonb_build_array(
        jsonb_build_object('name', 'Content-Type', 'value', 'application/json; charset=UTF-8')
      ),
      chr(123) || '"text":"Success","code":0' || chr(125)
    )
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('reply_rules');
  pgm.dropColumns('requests', [
    'response_status',
    'response_headers',
    'response_body',
    'response_rule',
    'response_delay_ms',
  ]);
};
