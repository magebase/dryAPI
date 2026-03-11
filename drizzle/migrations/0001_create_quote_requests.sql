CREATE TABLE IF NOT EXISTS quote_requests (
  id TEXT PRIMARY KEY NOT NULL,
  submission_type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  enquiry_type TEXT NOT NULL DEFAULT '',
  preferred_contact_method TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  source_path TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at
ON quote_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_requests_email
ON quote_requests (email);
