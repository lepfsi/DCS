import PDFDocument from 'pdfkit';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { storageDir } from './store';
import type { Branding } from './branding';

export function validateRequired(fields: Record<string, any>, required: string[]) {
  const missing = required.filter((k) => fields[k] === undefined || fields[k] === '' || fields[k] == null);
  if (missing.length > 0) {
    const err: any = new Error(`missing_required_fields: ${missing.join(', ')}`);
    err.status = 422; err.missing = missing;
    throw err;
  }
}

// Rendu contrôlé (US-1.4) : la structure du PDF vient du profil de marque de l'entreprise
// (UI-14). L'artefact généré est figé à l'émission ; sa vérification SHA-256 porte sur le fichier stocké.
export async function generatePdfBuffer(opts: {
  reference: string; title: string; typeCode: string; templateVersion: string;
  fields: Record<string, any>; revision: number; docDate?: string;
  signatureLines?: Array<{ role: string; name: string; date: string }>;
}, branding: Branding, logoBuffer?: Buffer | null): Promise<{ buffer: Buffer; sha256: string }> {
  const margin = branding.page.margin;
  const doc = new PDFDocument({
    size: 'A4', margin, bufferPages: true,
    info: { Title: opts.reference, Author: branding.companyName, CreationDate: new Date('2026-01-01T00:00:00Z') },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on('end', resolve));
  const W = doc.page.width;
  const inner = W - 2 * margin;
  const dateLine = opts.docDate ?? new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // ---- En-tête de marque ----
  const headerH = 64;
  let headerLeftY = margin;
  if (logoBuffer && branding.header.showLogo) {
    try {
      doc.image(logoBuffer, margin, margin, { height: 40, fit: [inner * 0.4, 40] });
      headerLeftY = margin + 44;
    } catch { /* logo illisible : on continue sans, jamais bloquant */ }
  }
  if (branding.header.showCompany) {
    const companyNameX = branding.header.align === 'right' ? margin : margin;
    doc.font('Helvetica-Bold').fontSize(13).fillColor(branding.colors.primary)
      .text(branding.companyName, companyNameX, headerLeftY, { width: inner, align: branding.header.align });
    if (branding.tagline) doc.font('Helvetica').fontSize(7.5).fillColor('#8a8f98')
      .text(branding.tagline, companyNameX, headerLeftY + 16, { width: inner, align: branding.header.align });
  }
  // Référence en vis-à-vis, et date en haut à droite si demandé.
  doc.font('Helvetica').fontSize(8.5).fillColor(branding.colors.text)
    .text(opts.reference, margin, margin + 46, { width: inner, align: 'right', lineBreak: false });
  if (branding.datePosition === 'top-right') {
    doc.fontSize(9).fillColor(branding.colors.text).text(dateLine, margin, margin + 4, { width: inner - 120, align: 'right', lineBreak: false });
  }
  if (branding.address.lines.length > 0) {
    doc.fontSize(7.5).fillColor('#8a8f98')
      .text(branding.address.lines.join('  ·  '), margin, margin + 58, { width: inner, align: 'right', lineBreak: false });
  }
  // Règle d'accent sous l'en-tête.
  const ruleY = margin + headerH;
  doc.moveTo(margin, ruleY).lineTo(W - margin, ruleY).lineWidth(1.4).strokeColor(branding.colors.accent).stroke();

  // ---- Titre ----
  doc.y = ruleY + 18;
  if (branding.datePosition === 'below-header') {
    doc.font('Helvetica').fontSize(9.5).fillColor(branding.colors.text).text(dateLine, margin, doc.y, { width: inner, align: 'right', lineBreak: false });
    doc.y += 14;
  }
  doc.font('Helvetica-Bold').fontSize(17).fillColor(branding.colors.text).text(opts.title, margin, doc.y, { width: inner });
  doc.font('Helvetica').fontSize(8.5).fillColor('#8a8f98')
    .text(`${opts.typeCode} · rév. ${opts.revision} · modèle v${opts.templateVersion}`, margin, doc.y + 4, { width: inner });
  doc.y += 26;

  // ---- Champs ----
  for (const [k, v] of Object.entries(opts.fields)) {
    const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === 'object' && 'label' in item) {
          const total = (Number(item.qty) || 1) * (Number(item.unitPrice) || 0);
          doc.font('Helvetica').fontSize(9.5).fillColor(branding.colors.text)
            .text(`${item.label} — ${item.qty ?? 1} × ${Number(item.unitPrice ?? 0).toLocaleString('fr-FR')} = ${total.toLocaleString('fr-FR')}`, margin, doc.y, { width: inner });
        } else {
          doc.font('Helvetica').fontSize(9.5).fillColor(branding.colors.text).text(String(item), margin, doc.y, { width: inner });
        }
      }
    } else if (typeof v !== 'object' || v === null) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#8a8f98').text(label.toUpperCase(), margin, doc.y, { width: inner });
      doc.font('Helvetica').fontSize(10).fillColor(branding.colors.text).text(v === null || v === undefined || v === '' ? '—' : String(v), margin, doc.y + 11, { width: inner });
      doc.y += 20;
    }
  }

  // ---- Zone de signature ----
  // Signature électronique : le document s'imprime DÉJÀ SIGNÉ — plus besoin de
  // signer physiquement. Sans signature : lignes vides pour signature manuscrite.
  const sigs = opts.signatureLines ?? [];
  if (branding.signatureBlock.show && (sigs.length > 0 || branding.signatureBlock.labels.length > 0)) {
    if (sigs.length > 0) {
      doc.y = Math.max(doc.y + 40, doc.page.height - margin - 60 - sigs.length * 26);
      for (const s of sigs) {
        doc.font('Helvetica').fontSize(9.5).fillColor(branding.colors.text)
          .text(`Pour ${s.role} — Signé électroniquement par ${s.name}, le ${s.date}.`, margin, doc.y, { width: inner });
        doc.moveTo(margin, doc.y + 14).lineTo(W - margin, doc.y + 14).lineWidth(0.6).strokeColor(branding.colors.accent).stroke();
        doc.y += 26;
      }
      doc.font('Helvetica').fontSize(7).fillColor('#9aa0a8')
        .text('Signature électronique — vérifiable en ligne, preuve horodatée conservée par le système.', margin, doc.y + 2, { width: inner });
    } else {
      doc.y = Math.max(doc.y + 48, doc.page.height - margin - 150);
      const colW = inner / branding.signatureBlock.labels.length;
      branding.signatureBlock.labels.forEach((lbl, i) => {
        const x = margin + i * colW;
        doc.moveTo(x + 10, doc.y + 34).lineTo(x + colW - 30, doc.y + 34).lineWidth(0.8).strokeColor('#c3c8cf').stroke();
        doc.font('Helvetica').fontSize(8).fillColor('#8a8f98').text(lbl, x + 10, doc.y + 38, { width: colW - 40 });
      });
    }
  }

  // ---- Pied de page (toutes pages) : gauche + droite, référence, date si en pied ----
  // Reste DANS la zone de contenu : au-delà (y > hauteur - marge), pdfkit ajouterait
  // une page par appel de texte — d'où des PDF de 3 pages pour un contenu d'une page.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottomY = doc.page.height - margin - 14;
    doc.font('Helvetica').fontSize(7.5).fillColor('#9aa0a8');
    let left = branding.footer.left;
    if (branding.footer.showReference) left = left ? `${left} · ${opts.reference}` : opts.reference;
    if (branding.datePosition === 'footer') left = left ? `${left} · ${dateLine}` : dateLine;
    if (left) doc.text(left, margin, bottomY, { width: inner, align: 'left', lineBreak: false });
    const right = branding.footer.right.replace(/\{page\}/g, String(i + 1 - range.start)).replace(/\{pages\}/g, String(range.count));
    if (right) doc.text(right, margin, bottomY, { width: inner, align: 'right', lineBreak: false });
  }

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
