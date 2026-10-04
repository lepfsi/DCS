import { z } from 'zod';

// Identité visuelle des documents (UI-14) : unique par entreprise, éditable visuellement.
// Le profil pilote le rendu PDF ET l'aperçu web : même structure, deux rendus.
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'couleur hex attendue (ex. #0e9f8a)');

export const brandingSchema = z.object({
  companyName: z.string().min(1),
  tagline: z.string(),
  colors: z.object({ primary: hex, accent: hex, text: hex }),
  page: z.object({ margin: z.number().min(24).max(90) }),
  header: z.object({ showLogo: z.boolean(), showCompany: z.boolean(), align: z.enum(['left', 'right', 'center']) }),
  footer: z.object({ left: z.string(), right: z.string(), showReference: z.boolean() }),
  address: z.object({ lines: z.array(z.string().max(120)).max(6) }),
  datePosition: z.enum(['top-right', 'below-header', 'footer']),
  signatureBlock: z.object({ show: z.boolean(), labels: z.array(z.string().max(60)).max(4) }),
});
export type Branding = z.infer<typeof brandingSchema>;

// LogoKey : géré uniquement par l'upload admin (jamais éditable en JSON).
export interface BrandingWithLogo extends Branding { logoKey?: string | null; }

export const DEFAULT_BRANDING: BrandingWithLogo = {
  companyName: 'DailyOps.Tech',
  tagline: 'Better documents. Smoother operations.',
  logoKey: null,
  colors: { primary: '#0e2a47', accent: '#0e9f8a', text: '#232a33' },
  page: { margin: 48 },
  header: { showLogo: true, showCompany: true, align: 'left' },
  footer: { left: 'DailyOps.Tech — Document contrôlé', right: 'Page {page}/{pages}', showReference: true },
  address: { lines: ['Douala, Cameroun'],
  },
  datePosition: 'top-right',
  signatureBlock: { show: true, labels: ['Pour DailyOps.Tech', 'Le client'] },
};

// Fusion profonde contrôlée : le patch (admin ou proposition IA) complète les défauts,
// jamais l'inverse — une proposition partielle ne casse jamais le profil existant.
export function mergeBranding(current: BrandingWithLogo, patch: any): BrandingWithLogo {
  return {
    companyName: str(patch?.companyName) || current.companyName,
    tagline: str(patch?.tagline ?? ''),
    colors: {
      primary: pickHex(patch?.colors?.primary) ?? current.colors.primary,
      accent: pickHex(patch?.colors?.accent) ?? current.colors.accent,
      text: pickHex(patch?.colors?.text) ?? current.colors.text,
    },
    page: { margin: clampNum(patch?.page?.margin, 24, 90, current.page.margin) },
    header: {
      showLogo: typeof patch?.header?.showLogo === 'boolean' ? patch.header.showLogo : current.header.showLogo,
      showCompany: typeof patch?.header?.showCompany === 'boolean' ? patch.header.showCompany : current.header.showCompany,
      align: ['left', 'right', 'center'].includes(patch?.header?.align) ? patch.header.align : current.header.align,
    },
    footer: {
      left: str(patch?.footer?.left ?? '') || current.footer.left,
      right: str(patch?.footer?.right ?? '') || current.footer.right,
      showReference: typeof patch?.footer?.showReference === 'boolean' ? patch.footer.showReference : current.footer.showReference,
    },
    address: {
      lines: Array.isArray(patch?.address?.lines)
        ? patch.address.lines.filter((l: any) => typeof l === 'string' && l.trim()).slice(0, 6).map((l: string) => l.slice(0, 120))
        : current.address.lines,
    },
    datePosition: ['top-right', 'below-header', 'footer'].includes(patch?.datePosition) ? patch.datePosition : current.datePosition,
    signatureBlock: {
      show: typeof patch?.signatureBlock?.show === 'boolean' ? patch.signatureBlock.show : current.signatureBlock.show,
      labels: Array.isArray(patch?.signatureBlock?.labels)
        ? patch.signatureBlock.labels.filter((l: any) => typeof l === 'string' && l.trim()).slice(0, 4).map((l: string) => l.slice(0, 60))
        : current.signatureBlock.labels,
    },
    // Le logo ne se change jamais par JSON : uniquement via l'upload dédié.
    logoKey: current.logoKey ?? null,
  };
}

// Formalise une proposition brute (IA ou patch) : remplit les manquants avec les défauts
// puis valide la forme complète. Renvoie null si inexploitable.
export function sanitizeProposal(raw: any): Branding | null {
  try {
    const merged = mergeBranding({ ...DEFAULT_BRANDING }, raw);
    const parsed = brandingSchema.safeParse(merged);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Extrait le premier objet JSON d'une réponse IA (blocs ```json, préambules, etc.).
export function extractJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

function str(v: any): string { return typeof v === 'string' ? v : ''; }
function pickHex(v: any): string | null { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null; }
function clampNum(v: any, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
