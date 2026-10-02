-- DCS - Schéma PostgreSQL v1 (source de vérité)
-- PRD §10, §14, §16. Postgres 15+. UUID via pgcrypto.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ Référentiels métier réutilisables ============
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  email CITEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','doc_manager','author','reviewer','approver','signer','viewer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- NOTE: CITEXT requiert l'extension citext ; sinon passer email en TEXT + index unique lower().
-- CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  address JSONB,
  tax_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT, phone TEXT, title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ Catalogue + templates ============
CREATE TABLE document_types (
  type_code TEXT PRIMARY KEY, -- ex. DO-BIZ-PROPOSAL
  family TEXT NOT NULL CHECK (family IN ('OFFICIAL','BUSINESS','LEGAL','CERTIFICATE','HR','FINANCE')),
  label TEXT NOT NULL,
  workflow_key TEXT NOT NULL, -- clé vers workflows/definitions.json
  required_roles JSONB NOT NULL DEFAULT '[]',
  retention_policy TEXT,
  default_confidentiality TEXT NOT NULL DEFAULT 'internal',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_code TEXT NOT NULL REFERENCES document_types(type_code),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version TEXT NOT NULL, -- ex. 1.3
  status TEXT NOT NULL CHECK (status IN ('draft','approved','retired')),
  definition JSONB NOT NULL, -- layout, bindings, conditions, blocs, signatures, output
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  UNIQUE (template_id, version)
);

-- ============ Numérotation transactionnelle ============
CREATE TABLE numbering_sequences (
  family TEXT NOT NULL,
  year INT NOT NULL,
  last_seq INT NOT NULL DEFAULT 0,
  PRIMARY KEY (family, year)
);
-- Allocation : SELECT ... FOR UPDATE puis last_seq+1 → DO-BIZ-2026-0042

-- ============ Documents ============
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE, -- DO-BIZ-2026-0042, immutable
  type_code TEXT NOT NULL REFERENCES document_types(type_code),
  template_version_id UUID REFERENCES template_versions(id),
  title TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN
    ('draft','in_review','changes_requested','approved','ready_to_sign','signed','issued','archived',
     'rejected','cancelled','expired','revoked','superseded')),
  owner_id UUID REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  contact_id UUID REFERENCES contacts(id),
  confidentiality TEXT NOT NULL DEFAULT 'internal',
  issue_date DATE, effective_date DATE,
  current_revision INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON documents (state);
CREATE INDEX ON documents (type_code);
CREATE INDEX ON documents (client_id);

CREATE TABLE document_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  rev INT NOT NULL,
  data_snapshot JSONB NOT NULL, -- valeurs structurées figées
  change_summary TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, rev)
);

CREATE TABLE document_field_values (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  rev INT NOT NULL,
  field_key TEXT NOT NULL,
  field_value JSONB,
  PRIMARY KEY (document_id, rev, field_key)
);

CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision_id UUID REFERENCES document_revisions(id),
  kind TEXT NOT NULL CHECK (kind IN ('pdf','docx')),
  storage_key TEXT NOT NULL, -- clé objet S3
  sha256 TEXT, -- obligatoire si émis/signé
  template_version_id UUID REFERENCES template_versions(id),
  is_authoritative BOOLEAN NOT NULL DEFAULT FALSE, -- un seul PDF faisant foi
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ Workflow + signatures ============
CREATE TABLE workflow_definitions (
  key TEXT PRIMARY KEY,
  definition JSONB NOT NULL -- miroir de workflows/definitions.json
);

CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  definition_key TEXT NOT NULL REFERENCES workflow_definitions(key),
  current_step TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL, -- approve_review, request_changes, approve, reject, sign...
  from_state TEXT, to_state TEXT,
  comment TEXT, -- motif obligatoire pour rejets/changements
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES artifacts(id),
  role TEXT NOT NULL, -- prepared_by, reviewed_by, approved_by, authorized_by, signed_by, accepted_by
  requested_of UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','declined','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES signature_requests(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES users(id),
  role TEXT NOT NULL,
  artifact_hash TEXT NOT NULL,
  auth_context JSONB,
  status TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ Liens entre documents (DCS §12 : Proposal → Contract → Invoice…) ============
CREATE TABLE document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  to_document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL, -- derives_from, amends, supersedes, invoices, evidences, relates_to
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_document_id <> to_document_id)
);
CREATE INDEX ON document_links (from_document_id);
CREATE INDEX ON document_links (to_document_id);

-- ============ Audit append-only ============
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision_id UUID REFERENCES document_revisions(id),
  artifact_id UUID REFERENCES artifacts(id),
  actor_id UUID REFERENCES users(id),
  actor_role TEXT,
  event_type TEXT NOT NULL,
  prev_state TEXT, new_state TEXT,
  change_summary TEXT, reason TEXT,
  source TEXT NOT NULL DEFAULT 'dcs.web',
  integrity JSONB, -- preuve P5 : y stocker chain (sha256 du maillon précédent + contenu)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_events (document_id, created_at);

-- Garde-fou append-only (aucun UPDATE/DELETE applicatif) :
-- REVOKE UPDATE, DELETE ON audit_events FROM dcs_app;
-- + trigger qui lève une exception sur UPDATE/DELETE.

-- ============ Certificats ============
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_no TEXT NOT NULL UNIQUE, -- DO-CER-2026-00482
  document_id UUID NOT NULL REFERENCES documents(id),
  holder_name TEXT NOT NULL,
  program_title TEXT NOT NULL,
  issued_at DATE NOT NULL,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','revoked','expired','superseded')),
  qr_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  result TEXT NOT NULL,
  source_ip TEXT
);
