// POS billing + GST invoices (Phase 5).
// BACKEND: POST /api/invoices creates the row + stock movement + audit entry in one transaction;
//          payment verification for Card via Razorpay; short-link is a signed URL to a hosted bill page.
import { KEYS, read, write, uid } from './storage'
import { gstSplit } from './pricing'
import { adjustStock, stockOverride } from './stock'
import { sendSms } from './sms'
import { log as auditLog } from './audit'

/** Standard GST rate for cosmetics & salon services in India (inclusive pricing). */
export const GST_RATE = 18

export type PayMethod = 'Cash' | 'Card' | 'Razorpay'
export type LineKind = 'product' | 'service' | 'custom' // custom = item typed in at the counter (no stock, not in the catalogue)

export interface PosLine {
  kind: LineKind
  id: string // product id or service name key
  sku: string
  name: string
  qty: number
  unitPrice: number // inclusive of GST
  gstRate: number
}

export interface GstBreakup {
  taxable: number
  cgst: number
  sgst: number
  total: number
}

export interface Invoice {
  id: string
  at: string
  customerName: string
  customerPhone: string
  lines: PosLine[]
  payment: PayMethod
  taxable: number
  cgst: number
  sgst: number
  total: number
  shortLink: string
  cashier: string
  cashierRole: string
  notes?: string
  /** false = bill without GST (no tax breakup, CGST / SGST are 0). Missing = with GST. */
  withGst?: boolean
  /** Customer GSTIN (only on bills with GST, optional). */
  gstin?: string
}

const seed: Invoice[] = [
  {
    id: 'INV-9001',
    at: '2026-10-08T14:05:00.000Z',
    customerName: 'Walk-in',
    customerPhone: '',
    lines: [
      { kind: 'product', id: 'p1', sku: 'RH-F-001', name: 'Rose Petal Radiance Serum', qty: 1, unitPrice: 2450, gstRate: 18 },
      { kind: 'service', id: 'svc-facial', sku: 'SVC', name: 'Normal Facial', qty: 1, unitPrice: 2200, gstRate: 18 },
    ],
    payment: 'Razorpay',
    taxable: 3940.68,
    cgst: 354.66,
    sgst: 354.66,
    total: 4650,
    shortLink: 'https://bill.revathi.demo/i/INV-9001',
    cashier: 'Ananya Iyer',
    cashierRole: 'Admin',
  },
]

function load(): Invoice[] {
  const stored = read<Invoice[]>(KEYS.invoices, [])
  if (stored.length === 0) {
    write(KEYS.invoices, seed)
    return seed
  }
  return stored
}

export function lineGst(line: PosLine): GstBreakup {
  const gross = line.unitPrice * line.qty
  const split = gstSplit(gross, line.gstRate)
  return { taxable: split.net, cgst: split.cgst, sgst: split.sgst, total: +(gross.toFixed(2)) }
}

export function cartGst(lines: PosLine[]): GstBreakup {
  return lines.reduce(
    (acc, l) => {
      const g = lineGst(l)
      return {
        taxable: +(acc.taxable + g.taxable).toFixed(2),
        cgst: +(acc.cgst + g.cgst).toFixed(2),
        sgst: +(acc.sgst + g.sgst).toFixed(2),
        total: +(acc.total + g.total).toFixed(2),
      }
    },
    { taxable: 0, cgst: 0, sgst: 0, total: 0 }
  )
}

export function listInvoices(limit = 100): Invoice[] {
  return load().slice(0, limit)
}

export function getInvoice(id: string): Invoice | undefined {
  return load().find((i) => i.id === id)
}

export interface CreateInvoiceInput {
  customerName: string
  customerPhone: string
  lines: PosLine[]
  payment: PayMethod
  cashier: string
  cashierRole: string
  notes?: string
  /** When true, deduct product stock via api.stock */
  deductStock?: boolean
  /** Catalogue base stock lookup: id -> baseStock */
  baseStockOf?: (id: string) => number
  /** Default true. false = bill without GST. */
  withGst?: boolean
  gstin?: string
}

export interface CreateInvoiceResult {
  invoice: Invoice
  stockErrors: string[]
}

/** Create invoice, optionally deduct stock, send SMS, write audit. */
export function createInvoice(input: CreateInvoiceInput): CreateInvoiceResult {
  if (!input.lines.length) throw new Error('Cart is empty')
  const gross = cartGst(input.lines)
  const withGst = input.withGst !== false
  // Without GST: same prices, no tax split shown or recorded.
  const gst: GstBreakup = withGst ? gross : { taxable: gross.total, cgst: 0, sgst: 0, total: gross.total }
  const id = nextInvoiceId()
  const shortLink = `https://bill.revathi.demo/i/${id}`
  const invoice: Invoice = {
    id,
    at: new Date().toISOString(),
    customerName: input.customerName.trim() || 'Walk-in',
    customerPhone: input.customerPhone.trim(),
    lines: input.lines.map((l) => ({ ...l })),
    payment: input.payment,
    taxable: gst.taxable,
    cgst: gst.cgst,
    sgst: gst.sgst,
    total: gst.total,
    shortLink,
    cashier: input.cashier,
    cashierRole: input.cashierRole,
    notes: input.notes,
    withGst,
    gstin: withGst && input.gstin?.trim() ? input.gstin.trim().toUpperCase() : undefined,
  }

  const stockErrors: string[] = []
  if (input.deductStock && input.baseStockOf) {
    for (const line of input.lines) {
      if (line.kind !== 'product') continue
      const base = input.baseStockOf(line.id)
      const current = stockOverride(line.id) ?? base
      if (current < line.qty) {
        stockErrors.push(`${line.name} (only ${current} left)`)
        continue
      }
      adjustStock({ id: line.id, sku: line.sku, name: line.name }, base, current - line.qty)
    }
  }

  write(KEYS.invoices, [invoice, ...load()].slice(0, 300))

  auditLog(
    input.cashier,
    input.cashierRole,
    'invoice.created',
    `POS invoice ${id} for ₹${invoice.total.toLocaleString('en-IN')} (${input.payment})`,
    { invoiceId: id, total: invoice.total, payment: input.payment }
  )

  if (input.customerPhone && /^[6-9]\d{9}$/.test(input.customerPhone)) {
    sendSms('invoice', input.customerPhone, [invoice.total, id, shortLink])
    auditLog(input.cashier, input.cashierRole, 'invoice.sms', `Invoice SMS sent for ${id} to ${input.customerPhone}`, {
      invoiceId: id,
      phone: input.customerPhone,
    })
  }

  return { invoice, stockErrors }
}

function nextInvoiceId(): string {
  const nums = load()
    .map((i) => parseInt(i.id.replace(/\D/g, ''), 10))
    .filter(Number.isFinite)
  const next = (nums.length ? Math.max(...nums) : 9000) + 1
  return `INV-${next}`
}

/** Revenue totals from POS invoices (for reports). */
export function posRevenueSummary() {
  const all = load()
  const total = all.reduce((s, i) => s + i.total, 0)
  const cgst = all.reduce((s, i) => s + i.cgst, 0)
  const sgst = all.reduce((s, i) => s + i.sgst, 0)
  const byPay: Record<string, number> = {}
  all.forEach((i) => {
    byPay[i.payment] = (byPay[i.payment] || 0) + i.total
  })
  return { count: all.length, total, cgst, sgst, byPay }
}
