import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db, save } from './store';
import { randomUUID } from 'crypto';

const SECRET = process.env.JWT_SECRET ?? 'dcs-dev-secret';

export interface AuthUser { id: string; email: string; role: string; roles?: string[]; displayName: string; }
declare global { namespace Express { interface Request { user?: AuthUser; } } }

// Rôles effectifs : le rôle principal + les rôles additionnels (ex : un PDG
// approbateur ET signataire). Les autorités se cumulent, rien ne s'enchaîne.
export function effectiveRoles(u: { role: string; roles?: string[] }): string[] {
  return [...new Set([u.role, ...(u.roles ?? [])])];
}

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 10); }
export async function checkPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }
export function signToken(u: AuthUser) { return jwt.sign(u, SECRET, { expiresIn: '12h' }); }

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_token' });
  try {
    const payload = jwt.verify(h.slice(7), SECRET) as AuthUser;
    // Identité fraîche : rôle, activation et nom se relisent en base à CHAQUE requête.
    // Un changement de rôle par l'admin, ou une désactivation, s'applique immédiatement —
    // le token (valide 12 h) ne fige plus les droits.
    const fresh = db.users.find((u) => u.id === payload.id);
    if (!fresh || !fresh.isActive) return res.status(401).json({ error: 'invalid_token' });
    req.user = { id: fresh.id, email: fresh.email, role: fresh.role, roles: effectiveRoles(fresh), displayName: fresh.displayName };
    next();
  } catch { return res.status(401).json({ error: 'invalid_token' }); }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    const mine = req.user.roles ?? [req.user.role];
    if (!roles.some((r) => mine.includes(r)) && !mine.includes('admin')) {
      return res.status(403).json({ error: 'forbidden', required: roles });
    }
    next();
  };
}

export async function seedUsers() {
  if (db.users.length > 0) return;
  const mk = async (email: string, displayName: string, role: string, pw: string, department?: string) => ({
    id: randomUUID(), email, displayName, role, department,
    passwordHash: await hashPassword(pw), isActive: true,
  });
  db.users.push(
    await mk('admin@dailyops.tech', 'Admin DCS', 'admin', 'admin123', 'Direction'),
    await mk('manager@dailyops.tech', 'Doc Manager', 'doc_manager', 'manager123', 'Direction'),
    await mk('author@dailyops.tech', 'Auteur', 'author', 'author123', 'Technique'),
    await mk('reviewer@dailyops.tech', 'Reviewer', 'reviewer', 'reviewer123', 'Technique'),
    await mk('approver@dailyops.tech', 'Approver', 'approver', 'approver123', 'Direction'),
  );
  await save();
}
