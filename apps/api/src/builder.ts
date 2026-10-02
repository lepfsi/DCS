export interface FieldDef { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'currency' | 'date'; required: boolean; help?: string; }
export interface DocSchema { type_code: string; templateVersion: string; blocks: string[]; fields: FieldDef[]; required: string[]; }

export const LINK_TYPES = ['derives_from', 'amends', 'supersedes', 'invoices', 'evidences', 'relates_to'] as const;

// Schéma effectif : definition.fields si présent, sinon reconstruit depuis required + valeurs connues (fallback).
export function buildSchema(type_code: string, templateVersion: string, definition: any, knownKeys: string[] = []): DocSchema {
  const blocks: string[] = definition?.blocks ?? [];
  if (Array.isArray(definition?.fields) && definition.fields.length > 0) {
    const fields = definition.fields as FieldDef[];
    return { type_code, templateVersion, blocks, fields, required: fields.filter((f) => f.required).map((f) => f.key) };
  }
  const required: string[] = definition?.required ?? [];
  const keys = [...new Set([...required, ...knownKeys])];
  return {
    type_code, templateVersion, blocks, required,
    fields: keys.map((k) => ({ key: k, label: k, type: 'text' as const, required: required.includes(k) })),
  };
}

export interface Diff { from: number; to: number; added: string[]; removed: string[]; changed: string[]; }

// Diff shallow sur snapshots (US-2.3). Comparaison par JSON pour objets/tableaux.
export function diffSnapshots(from: number, a: Record<string, any>, to: number, b: Record<string, any>): Diff {
  const ka = new Set(Object.keys(a ?? {})); const kb = new Set(Object.keys(b ?? {}));
  const added = [...kb].filter((k) => !ka.has(k));
  const removed = [...ka].filter((k) => !kb.has(k));
  const changed = [...ka].filter((k) => kb.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  return { from, to, added, removed, changed };
}

export function validateLink(fromId: string, toId: string, link_type: string, exists: (id: string) => boolean): void {
  if (!exists(fromId) || !exists(toId)) {
    const err: any = new Error('unknown_document'); err.status = 404; throw err;
  }
  if (fromId === toId) {
    const err: any = new Error('self_link_forbidden'); err.status = 422; throw err;
  }
  if (!(LINK_TYPES as readonly string[]).includes(link_type)) {
    const err: any = new Error(`invalid_link_type (attendus: ${LINK_TYPES.join(', ')})`); err.status = 422; throw err;
  }
}
