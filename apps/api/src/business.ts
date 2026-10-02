// Objets métier P6 (DCS §10) : le minimum structuré pour exécuter les documents.
// Frontière §11 : montants, taxes, échéances et statuts de paiement oui.
// Grand livre, comptabilité en partie double : non.

export interface Customer { id: string; name: string; address?: string; taxId?: string; email?: string; phone?: string; createdAt: string; }
export interface Person { id: string; fullName: string; email?: string; phone?: string; title?: string; customerId?: string; createdAt: string; }
export interface Employee { id: string; fullName: string; title?: string; email?: string; createdAt: string; }
export interface Project { id: string; title: string; code?: string; customerId?: string; status?: string; createdAt: string; }
export interface Service { id: string; name: string; unitPrice: number; currency: string; description?: string; createdAt: string; }
export interface Transaction { id: string; kind: 'proposal' | 'order' | 'invoice' | 'payment'; customerId?: string; projectId?: string; documentIds: string[]; amount?: number; currency: string; status: 'draft' | 'pending' | 'partial' | 'paid' | 'cancelled'; createdBy: string; createdAt: string; }

export interface MoneyLine { label: string; qty: number; unitPrice: number; }
export interface MoneyTotals { subtotal: number; discountAmount: number; taxable: number; taxAmount: number; total: number; currency: string; }

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Certificate { id: string; certificateNo: string; documentId: string; holderName: string; programTitle: string; issuedAt: string; expiresAt?: string | null; status: 'valid' | 'revoked'; qrUrl: string; issuedBy: string; createdAt: string; }

// Statut effectif : révocation d'abord, expiration calculée, jamais de données internes exposées.
export function effectiveStatus(cert: Pick<Certificate, 'status' | 'expiresAt'>, nowIso: string = new Date().toISOString()): 'valid' | 'revoked' | 'expired' {
  if (cert.status === 'revoked') return 'revoked';
  if (cert.expiresAt && cert.expiresAt < nowIso.slice(0, 10)) return 'expired';
  return 'valid';
}

// Confidentialité (US-7.2) : restricted = owner, admin, doc_manager uniquement.
export function canViewDoc(doc: { ownerId: string; confidentiality?: string | null }, user: { id: string; role: string }): boolean {
  if (doc.confidentiality !== 'restricted') return true;
  return doc.ownerId === user.id || user.role === 'admin' || user.role === 'doc_manager';
}

// Confidentialité par défaut : HR sensible, le reste interne.
export function defaultConfidentiality(family: string, typeDefault?: string): string {
  if (typeDefault) return typeDefault;
  if (family === 'HR') return 'confidential';
  return 'internal';
}

// Totaux canoniques : remises puis taxes sur le net (US-6.3).
export function computeTotals(lines: MoneyLine[], opts: { taxRate?: number; discount?: number; currency?: string } = {}): MoneyTotals {
  const currency = opts.currency ?? 'XAF';
  const subtotal = r2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const discountAmount = r2(subtotal * ((opts.discount ?? 0) / 100));
  const taxable = r2(subtotal - discountAmount);
  const taxAmount = r2(taxable * ((opts.taxRate ?? 0) / 100));
  return { subtotal, discountAmount, taxable, taxAmount, total: r2(taxable + taxAmount), currency };
}

const TX_NEXT: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['partial', 'paid', 'cancelled'],
  partial: ['paid', 'cancelled'],
  paid: [], cancelled: [],
};

export function checkTxTransition(from: string, to: string): void {
  if (!(TX_NEXT[from] ?? []).includes(to)) {
    const err: any = new Error(`statut '${to}' impossible depuis '${from}'`);
    err.status = 409; throw err;
  }
}

// Pré-remplissage proposition (cas §9) : client, projet, lignes de service, conditions.
export function prefillFields(input: {
  customer?: Customer | null; project?: Project | null; services?: Service[];
}): Record<string, any> {
  const fields: Record<string, any> = {};
  if (input.customer) {
    fields.client = input.customer.name;
    if (input.customer.address) fields.client_address = input.customer.address;
  }
  if (input.project) {
    fields.project_title = input.project.title;
    if (input.project.code) fields.project_code = input.project.code;
  }
  if (input.services && input.services.length > 0) {
    const lines = input.services.map((s) => ({ label: s.name, qty: 1, unitPrice: s.unitPrice }));
    const totals = computeTotals(lines, { currency: input.services[0].currency });
    fields.items = lines;
    fields.fees = totals.total;
  }
  fields.payment_terms = '30% à la commande, solde à la livraison';
  fields.validity = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return fields;
}
