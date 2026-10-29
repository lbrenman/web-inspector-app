exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('notes', {
    id: 'id',
    title: { type: 'varchar(200)', notNull: true },
    body: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.createIndex('notes', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('notes');
};
