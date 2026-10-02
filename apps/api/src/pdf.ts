import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { storageDir } from './store';

export function validateRequired(fields: Record<string, any>, required: string[]) {
  const missing = required.filter((k) => fields[k] === undefined || fields[k] === '' || fields[k] == null);
  if (missing.length > 0) {
    const err: any = new Error(`missing_required_fields: ${missing.join(', ')}`);
    err.status = 422; err.missing = missing;
    throw err;
  }
}

// Rendu déterministe (US-1.4) : même révision + même template => même contenu => même SHA-256.
// Note : CreationDate normalisée pour déterminisme.
export async function generatePdfBuffer(opts: {
  reference: string; title: string; typeCode: string; templateVersion: string;
  fields: Record<string, any>; revision: number;
}): Promise<{ buffer: Buffer; sha256: string }> {
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: opts.reference, Author: 'DailyOps DCS', CreationDate: new Date('2026-01-01T00:00:00Z') } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on('end', resolve));

  doc.fontSize(10).fillColor('#555').text('DAILYOPS.TECH - DCS · Document contrôlé');
  doc.moveDown();
  doc.fontSize(20).fillColor('#111').text(opts.title);
  doc.fontSize(10).fillColor('#333').text(`${opts.reference} · ${opts.typeCode} · rév. ${opts.revision} · template ${opts.templateVersion}`);
  doc.moveDown();
  doc.fontSize(11).fillColor('#111');
  for (const [k, v] of Object.entries(opts.fields)) {
    doc.text(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  }
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#777').text(`Footer - ${opts.reference} · page contrôlée · PDF faisant foi (DOCX = commodité)`);
  doc.end();
  await done;
  const buffer = Buffer.concat(chunks);
  return { buffer, sha256: createHash('sha256').update(buffer).digest('hex') };
}

export function saveArtifactFile(storageKey: string, buffer: Buffer) {
  const file = path.join(storageDir(), storageKey);
  fs.writeFileSync(file, buffer);
  return file;
}
