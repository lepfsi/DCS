'use client';
import { useState } from 'react';

const SIZES = [10, 20, 50, 100];

// Pagination par blocs : 10, 20, 50, 100. Jamais de liste illimitée.
export default function Pager({ total, pageSize, setPageSize, page, setPage }: {
  total: number; pageSize: number; setPageSize: (n: number) => void; page: number; setPage: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(page, pages - 1);
  return (
    <div className="pager">
      <span>{total} éléments</span>
      <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }} aria-label="Par page">
        {SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
      </select>
      <button className="btn" disabled={p <= 0} onClick={() => setPage(p - 1)}>Précédent</button>
      <span>Page {p + 1} / {pages}</span>
      <button className="btn" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Suivant</button>
    </div>
  );
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  return rows.slice(page * pageSize, page * pageSize + pageSize);
}
