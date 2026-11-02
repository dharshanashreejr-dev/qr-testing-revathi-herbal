// Immutable audit log (Phase 5). Append-only; UI can only list/filter, never edit or delete.
// BACKEND: write to an append-only table (or event store). Never UPDATE/DELETE rows.
import { KEYS, read, write, uid } from './storage'

export type AuditAction =
  | 'invoice.created'
  | 'invoice.sms'
  | 'stock.adjusted'
  | 'order.status'
  | 'booking.status'
  | 'auth.login'
  | 'auth.logout'
  | 'settings.changed'
  | 'staff.updated'
  | 'product.updated'
  | 'offer.updated'

export interface AuditEntry {
  id: string
  at: string
  actor: string // user name or 'System'
  role: string
  action: AuditAction
  summary: string
  meta?: Record<string, string | number>
}

const seed: AuditEntry[] = [
  { id: 'aud-seed-1', at: '2026-10-09T09:12:00.000Z', actor: 'Ananya Iyer', role: 'Admin', action: 'auth.login', summary: 'Admin signed in' },
  { id: 'aud-seed-2', at: '2026-10-09T09:45:00.000Z', actor: 'Ananya Iyer', role: 'Admin', action: 'stock.adjusted', summary: 'Restocked Botanical Repair Hair Mask to 28 units', meta: { sku: 'MB-1003', next: 28 } },
  { id: 'aud-seed-3', at: '2026-10-08T16:20:00.000Z', actor: 'Meera Nair', role: 'Staff', action: 'order.status', summary: 'ORD-5004 marked as Delivered', meta: { orderId: 'ORD-5004' } },
  { id: 'aud-seed-4', at: '2026-10-08T14:05:00.000Z', actor: 'Ananya Iyer', role: 'Admin', action: 'invoice.created', summary: 'POS invoice INV-9001 for ₹4,850 (Razorpay)', meta: { invoiceId: 'INV-9001', total: 4850 } },
  { id: 'aud-seed-5', at: '2026-10-07T11:30:00.000Z', actor: 'System', role: 'System', action: 'settings.changed', summary: 'Low-stock threshold set to 10' },
]

function load(): AuditEntry[] {
  const stored = read<AuditEntry[]>(KEYS.audit, [])
  if (stored.length === 0) {
    write(KEYS.audit, seed)
    return seed
  }
  return stored
}

/** Append one entry. Never mutates existing rows. */
export function log(
  actor: string,
  role: string,
  action: AuditAction,
  summary: string,
  meta?: Record<string, string | number>
): AuditEntry {
  const entry: AuditEntry = {
    id: uid('aud'),
    at: new Date().toISOString(),
    actor,
    role,
    action,
    summary,
    meta,
  }
  write(KEYS.audit, [entry, ...load()].slice(0, 500))
  return entry
}

export const list = (limit = 200): AuditEntry[] => load().slice(0, limit)

export function filter(opts: {
  q?: string
  action?: string
  actor?: string
  since?: string
}): AuditEntry[] {
  let rows = load()
  if (opts.action && opts.action !== 'All') rows = rows.filter((r) => r.action === opts.action)
  if (opts.actor && opts.actor !== 'All') rows = rows.filter((r) => r.actor === opts.actor)
  if (opts.since) rows = rows.filter((r) => r.at >= opts.since!)
  if (opts.q?.trim()) {
    const q = opts.q.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.summary.toLowerCase().includes(q) ||
        r.actor.toLowerCase().includes(q) ||
        r.action.includes(q) ||
        r.id.toLowerCase().includes(q)
    )
  }
  return rows
}
