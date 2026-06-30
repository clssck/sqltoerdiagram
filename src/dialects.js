// SQL dialects. Drives the default type for newly-added columns and the type
// suggestions shown while editing a column type.
export const DIALECTS = {
  postgres: {
    label: 'PostgreSQL',
    default: 'text',
    types: ['integer', 'bigint', 'smallint', 'serial', 'bigserial', 'text',
      'varchar(255)', 'char(1)', 'boolean', 'timestamptz', 'timestamp', 'date',
      'time', 'numeric(12,2)', 'real', 'double precision', 'jsonb', 'json',
      'uuid', 'bytea', 'inet'],
  },
  mysql: {
    label: 'MySQL',
    default: 'varchar(255)',
    types: ['int', 'bigint', 'smallint', 'tinyint(1)', 'varchar(255)', 'char(1)',
      'text', 'longtext', 'datetime', 'timestamp', 'date', 'time',
      'decimal(12,2)', 'float', 'double', 'json', 'enum', 'blob'],
  },
  sqlite: {
    label: 'SQLite',
    default: 'TEXT',
    types: ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN'],
  },
  sqlserver: {
    label: 'SQL Server',
    default: 'nvarchar(255)',
    types: ['int', 'bigint', 'smallint', 'tinyint', 'bit', 'nvarchar(255)',
      'varchar(255)', 'nchar(1)', 'nvarchar(max)', 'datetime2', 'date', 'time',
      'decimal(12,2)', 'float', 'real', 'uniqueidentifier', 'varbinary(max)'],
  },
  snowflake: {
    label: 'Snowflake',
    default: 'VARCHAR',
    types: ['NUMBER(38,0)', 'INT', 'BIGINT', 'SMALLINT', 'FLOAT', 'NUMBER(12,2)',
      'VARCHAR', 'VARCHAR(255)', 'CHAR(1)', 'STRING', 'TEXT', 'BOOLEAN',
      'DATE', 'TIME', 'TIMESTAMP_NTZ', 'TIMESTAMP_TZ', 'VARIANT', 'OBJECT',
      'ARRAY', 'BINARY', 'GEOGRAPHY'],
  },
};

export const DEFAULT_DIALECT = 'postgres';
