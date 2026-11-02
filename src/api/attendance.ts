// Attendance, shifts, leave, holidays, devices, disputes.
// BACKEND: REST under /api/attendance|shifts|leave|holidays|devices — enforce staff can only read/write own rows server-side.
import { uid } from './storage'

export type PunchType = 'IN' | 'OUT'
export type DayStatus = 'Present' | 'Late' | 'Absent' | 'Leave' | 'Weekly off' | 'Holiday' | 'Half day'
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
export type DisputeStatus = 'Pending' | 'Approved' | 'Rejected'

export interface Shift {
  id: string; name: string; start: string; end: string; graceMins: number; weeklyOff: number[] // 0=Sun
}
export interface Punch {
  id: string; staffId: string; staffName: string; at: string; type: PunchType; source: 'Device' | 'Manual' | 'App' | 'QR'; deviceId?: string; note?: string
}
export interface AttendanceDay {
  staffId: string; date: string; status: DayStatus; inAt?: string; outAt?: string; lateMins?: number; otMins?: number
}
export interface LeaveRequest {
  id: string; staffId: string; staffName: string; type: string; from: string; to: string; days: number; reason: string; status: LeaveStatus; createdAt: string; decidedBy?: string; decisionNote?: string
}
export interface LeaveBalance { staffId: string; casual: number; sick: number; earned: number }
export interface Holiday { id: string; date: string; name: string; optional?: boolean }
export interface Device {
  id: string; name: string; location: string; status: 'Online' | 'Offline'; lastSync: string; enrolled: number
}
export interface DeviceMap { staffId: string; deviceUserId: string; enrolled: boolean }
export interface Dispute {
  id: string; staffId: string; staffName: string; date: string; message: string; status: DisputeStatus; createdAt: string; resolvedBy?: string; note?: string
}
export interface Correction {
  id: string; punchId?: string; staffId: string; staffName: string; date: string; type: PunchType; at: string; reason: string; by: string; atLogged: string
}

const K = {
  shifts: 'rhb-hr-shifts',
  punches: 'rhb-hr-punches',
  leave: 'rhb-hr-leave',
  balance: 'rhb-hr-leave-bal',
  holidays: 'rhb-hr-holidays',
  devices: 'rhb-hr-devices',
  deviceMap: 'rhb-hr-device-map',
  disputes: 'rhb-hr-disputes',
  corrections: 'rhb-hr-corrections',
}

const today = () => new Date().toISOString().slice(0, 10)
const iso = (d: Date) => d.toISOString()

function seedShifts(): Shift[] {
  return [
    { id: 'SH-1', name: 'Morning', start: '09:00', end: '18:00', graceMins: 10, weeklyOff: [0] },
    { id: 'SH-2', name: 'Evening', start: '12:00', end: '21:00', graceMins: 10, weeklyOff: [1] },
  ]
}
function seedHolidays(): Holiday[] {
  const y = new Date().getFullYear()
  return [
    { id: 'H1', date: `${y}-01-01`, name: 'New Year' },
    { id: 'H2', date: `${y}-01-15`, name: 'Pongal' },
    { id: 'H3', date: `${y}-08-15`, name: 'Independence Day' },
    { id: 'H4', date: `${y}-10-02`, name: 'Gandhi Jayanti' },
    { id: 'H5', date: `${y}-12-25`, name: 'Christmas' },
  ]
}
function seedDevices(): Device[] {
  return [
    { id: 'DEV-01', name: 'Reception biometric', location: 'Front desk', status: 'Online', lastSync: iso(new Date()), enrolled: 6 },
    { id: 'DEV-02', name: 'Staff room tablet', location: 'Back office', status: 'Offline', lastSync: iso(new Date(Date.now() - 86400000)), enrolled: 4 },
  ]
}

const r = <T,>(k: string, fallback: T): T => {
  try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? fallback : v } catch { return fallback }
}
const w = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export const listShifts = () => { const x = r<Shift[]>(K.shifts, []); if (!x.length) { w(K.shifts, seedShifts()); return seedShifts() } return x }
export const saveShifts = (list: Shift[]) => w(K.shifts, list)

export const listHolidays = () => { const x = r<Holiday[]>(K.holidays, []); if (!x.length) { const s = seedHolidays(); w(K.holidays, s); return s } return x }
export const saveHolidays = (list: Holiday[]) => w(K.holidays, list)

export const listDevices = () => { const x = r<Device[]>(K.devices, []); if (!x.length) { const s = seedDevices(); w(K.devices, s); return s } return x }
export const listDeviceMap = () => r<DeviceMap[]>(K.deviceMap, [])
export const saveDeviceMap = (list: DeviceMap[]) => w(K.deviceMap, list)

export const listPunches = () => r<Punch[]>(K.punches, [])
export const addPunch = (p: Omit<Punch, 'id'>) => {
  const row: Punch = { ...p, id: uid('P') }
  w(K.punches, [row, ...listPunches()])
  return row
}

/** QR + fingerprint punches come from the server; add the ones we do not have yet. Returns true when something new was added. */
export const mergePunches = (incoming: Punch[]) => {
  const have = new Set(listPunches().map((p) => p.id))
  const fresh = incoming.filter((p) => !have.has(p.id))
  if (fresh.length) w(K.punches, [...fresh, ...listPunches()])
  return fresh.length > 0
}

export const listCorrections = () => r<Correction[]>(K.corrections, [])
export const addCorrection = (c: Omit<Correction, 'id' | 'atLogged'>, actor: string) => {
  const row: Correction = { ...c, id: uid('C'), atLogged: iso(new Date()) }
  w(K.corrections, [row, ...listCorrections()])
  // also write a manual punch
  addPunch({ staffId: c.staffId, staffName: c.staffName, at: c.at, type: c.type, source: 'Manual', note: c.reason })
  return row
}

export const listLeave = () => r<LeaveRequest[]>(K.leave, [])
export const saveLeave = (list: LeaveRequest[]) => w(K.leave, list)
export const applyLeave = (req: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) => {
  const row: LeaveRequest = { ...req, id: uid('LV'), status: 'Pending', createdAt: iso(new Date()) }
  w(K.leave, [row, ...listLeave()])
  return row
}
export const decideLeave = (id: string, status: 'Approved' | 'Rejected', by: string, note = '') => {
  w(K.leave, listLeave().map((x) => x.id === id ? { ...x, status, decidedBy: by, decisionNote: note } : x))
}

export const getBalance = (staffId: string): LeaveBalance => {
  const all = r<LeaveBalance[]>(K.balance, [])
  let b = all.find((x) => x.staffId === staffId)
  if (!b) { b = { staffId, casual: 6, sick: 6, earned: 12 }; w(K.balance, [...all, b]) }
  return b
}
export const setBalance = (b: LeaveBalance) => {
  const all = r<LeaveBalance[]>(K.balance, []).filter((x) => x.staffId !== b.staffId)
  w(K.balance, [...all, b])
}

export const listDisputes = () => r<Dispute[]>(K.disputes, [])
export const addDispute = (d: Omit<Dispute, 'id' | 'status' | 'createdAt'>) => {
  const row: Dispute = { ...d, id: uid('D'), status: 'Pending', createdAt: iso(new Date()) }
  w(K.disputes, [row, ...listDisputes()])
  return row
}
export const decideDispute = (id: string, status: 'Approved' | 'Rejected', by: string, note = '') => {
  w(K.disputes, listDisputes().map((x) => x.id === id ? { ...x, status, resolvedBy: by, note } : x))
}

/** Build today's live board from staff list + punches (mock). */
export function liveBoard(staff: { id: string; name: string; shiftId?: string; availability?: string }[]) {
  const t = today()
  const punches = listPunches().filter((p) => p.at.slice(0, 10) === t)
  const shifts = listShifts()
  const leave = listLeave().filter((l) => l.status === 'Approved' && l.from <= t && l.to >= t)
  return staff.map((s) => {
    const mine = punches.filter((p) => p.staffId === s.id).sort((a, b) => a.at.localeCompare(b.at))
    const inn = mine.find((p) => p.type === 'IN')
    const out = [...mine].reverse().find((p) => p.type === 'OUT')
    const onLeave = leave.some((l) => l.staffId === s.id)
    const shift = shifts.find((x) => x.id === (s as any).shiftId) || shifts[0]
    let status: DayStatus = 'Absent'
    let lateMins = 0
    if (onLeave) status = 'Leave'
    else if (inn) {
      status = 'Present'
      if (shift) {
        const [hh, mm] = shift.start.split(':').map(Number)
        const start = new Date(inn.at); start.setHours(hh, mm + shift.graceMins, 0, 0)
        if (new Date(inn.at) > start) { status = 'Late'; lateMins = Math.round((new Date(inn.at).getTime() - start.getTime()) / 60000) }
      }
    }
    return { staffId: s.id, name: s.name, status, inAt: inn?.at, outAt: out?.at, lateMins, shift: shift?.name }
  })
}

/** Seed demo punches for today so the live board is not empty. */
export function seedDemoPunches(staff: { id: string; name: string }[]) {
  return // QR demo: no fake punches, only real QR + fingerprint punches show up
  if (listPunches().some((p) => p.at.slice(0, 10) === today())) return
  const now = new Date()
  staff.slice(0, Math.min(5, staff.length)).forEach((s, i) => {
    const inn = new Date(now); inn.setHours(9, 5 + i * 3, 0, 0)
    addPunch({ staffId: s.id, staffName: s.name, at: inn.toISOString(), type: 'IN', source: 'Device', deviceId: 'DEV-01' })
    if (i < 2) {
      const out = new Date(now); out.setHours(18, 2 + i, 0, 0)
      addPunch({ staffId: s.id, staffName: s.name, at: out.toISOString(), type: 'OUT', source: 'Device', deviceId: 'DEV-01' })
    }
  })
}

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
