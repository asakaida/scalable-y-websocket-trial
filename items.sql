CREATE TABLE items
(
    id      BIGSERIAL NOT NULL UNIQUE,
    docname TEXT NOT NULL,
    update  BYTEA
);

CREATE INDEX items_docname_idx ON items (docname);