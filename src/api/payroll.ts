// Payroll, payslips, advances & deductions.
// BACKEND: /api/payroll — salary structures, monthly runs, lock, PDF generation; staff endpoints return only own payslips.
import { uid } from './storage'

const r = <T,>(k: string, fallback: T): T => {
  try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fallback : v } catch { return fallback }
}
const w = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export interface SalaryStructure {
  staffId: string; base: number; hra: number; incentivePct: number; bankName?: string; accountNo?: string; ifsc?: string
}
export interface Advance {
  id: string; staffId: string; staffName: string; amount: number; reason: string; month: string; recovered: boolean; createdAt: string
}
export interface Deduction {
  id: string; staffId: string; staffName: string; amount: number; reason: string; month: string; createdAt: string
}
export interface PayslipLine {
  staffId: string; staffName: string; base: number; hra: number; incentive: number; advances: number; deductions: number; net: number; presentDays: number; paidDays: number
}
export interface PayrollRun {
  id: string; month: string; status: 'Draft' | 'Approved' | 'Locked'; lines: PayslipLine[]; createdAt: string; approvedBy?: string
}

// MD instruction: HRA is locked (not used) for now. Set to true to bring it back.
export const HRA_ENABLED = false

const K = { sal: 'rhb-hr-salary', adv: 'rhb-hr-advances', ded: 'rhb-hr-deductions', runs: 'rhb-hr-payroll-runs' }

export const getSalary = (staffId: string): SalaryStructure => {
  const all = r<SalaryStructure[]>(K.sal, [])
  let s = all.find((x) => x.staffId === staffId)
  if (!s) { s = { staffId, base: 18000, hra: 0, incentivePct: 5 }; w(K.sal, [...all, s]) }
  return s
}
export const setSalary = (s: SalaryStructure) => {
  w(K.sal, [...r<SalaryStructure[]>(K.sal, []).filter((x) => x.staffId !== s.staffId), s])
}
export const listSalaries = () => r<SalaryStructure[]>(K.sal, [])

export const listAdvances = () => r<Advance[]>(K.adv, [])
export const addAdvance = (a: Omit<Advance, 'id' | 'createdAt' | 'recovered'>) => {
  const row: Advance = { ...a, id: uid('AD'), recovered: false, createdAt: new Date().toISOString() }
  w(K.adv, [row, ...listAdvances()]); return row
}

export const listDeductions = () => r<Deduction[]>(K.ded, [])
export const addDeduction = (d: Omit<Deduction, 'id' | 'createdAt'>) => {
  const row: Deduction = { ...d, id: uid('DD'), createdAt: new Date().toISOString() }
  w(K.ded, [row, ...listDeductions()]); return row
}

export const listRuns = () => r<PayrollRun[]>(K.runs, [])
export const getRun = (month: string) => listRuns().find((x) => x.month === month)

export function previewRun(month: string, staff: { id: string; name: string }[], presentDaysMap: Record<string, number>): PayrollRun {
  const lines: PayslipLine[] = staff.map((s) => {
    const sal = getSalary(s.id)
    const presentDays = presentDaysMap[s.id] ?? 22
    const paidDays = Math.min(30, presentDays)
    const factor = paidDays / 30
    const base = Math.round(sal.base * factor)
    const hra = HRA_ENABLED ? Math.round(sal.hra * factor) : 0
    const incentive = Math.round((base + hra) * (sal.incentivePct / 100))
    const advances = listAdvances().filter((a) => a.staffId === s.id && a.month === month && !a.recovered).reduce((n, a) => n + a.amount, 0)
    const deductions = listDeductions().filter((d) => d.staffId === s.id && d.month === month).reduce((n, d) => n + d.amount, 0)
    const net = base + hra + incentive - advances - deductions
    return { staffId: s.id, staffName: s.name, base, hra, incentive, advances, deductions, net, presentDays, paidDays }
  })
  return { id: uid('PR'), month, status: 'Draft', lines, createdAt: new Date().toISOString() }
}

export function saveRun(run: PayrollRun) {
  const others = listRuns().filter((x) => x.month !== run.month)
  w(K.runs, [run, ...others])
}
export function approveRun(month: string, by: string) {
  const run = getRun(month); if (!run || run.status === 'Locked') return
  saveRun({ ...run, status: 'Approved', approvedBy: by })
}
export function lockRun(month: string) {
  const run = getRun(month); if (!run) return
  saveRun({ ...run, status: 'Locked' })
}

/** Simple printable payslip HTML (browser print → PDF). BACKEND: server-side PDF. */
export function payslipHtml(line: PayslipLine, month: string, salon = 'Revathi Herbal Beauty Care') {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Payslip ${month} — ${line.staffName}</title>
  <style>body{font-family:system-ui,sans-serif;padding:32px;color:#3A2A2E}h1{font-size:20px;margin:0 0 4px}.muted{color:#8E4A66;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:10px 8px;border-bottom:1px solid #FBEDEB;text-align:left}
  .net{font-size:18px;font-weight:700}</style></head><body>
  <h1>${salon}</h1><p class="muted">Payslip · ${month}</p>
  <p><strong>${line.staffName}</strong><br/><span class="muted">Staff ID: ${line.staffId}</span></p>
  <table><tr><th>Component</th><th>Amount (₹)</th></tr>
  <tr><td>Basic</td><td>${line.base.toLocaleString('en-IN')}</td></tr>
  ${HRA_ENABLED ? `<tr><td>HRA</td><td>${line.hra.toLocaleString('en-IN')}</td></tr>` : ''}
  <tr><td>Incentive</td><td>${line.incentive.toLocaleString('en-IN')}</td></tr>
  <tr><td>Advances recovered</td><td>- ${line.advances.toLocaleString('en-IN')}</td></tr>
  <tr><td>Deductions</td><td>- ${line.deductions.toLocaleString('en-IN')}</td></tr>
  <tr><td class="net">Net pay</td><td class="net">${line.net.toLocaleString('en-IN')}</td></tr></table>
  <p class="muted">Paid days: ${line.paidDays} / Present: ${line.presentDays}</p>
  <script>window.print()</script></body></html>`
}
