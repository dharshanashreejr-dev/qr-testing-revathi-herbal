// Simulated SMS gateway. Nothing is really sent: each message is written to an "outbox" so the UI
// (and the admin SMS log, Phase 5) can show exactly what the customer would receive.
// BACKEND: replace sendSms() with a call to the TRAI DLT-compliant gateway. Templates must be DLT-registered.
import { KEYS, read, write, uid } from './storage'

export type SmsKey = 'otp' | 'orderSuccess' | 'orderDispatched' | 'apptConfirmed' | 'apptReminder' | 'invoice' | 'backInStock' | 'lowStock' | 'festival'
export type DltCategory = 'Service Implicit' | 'Service Explicit' | 'Promotional'

// Same wording and variable order as section 5 of the CRS ({#var#} = one variable).
export const SMS_TEMPLATES: Record<SmsKey, { category: DltCategory; text: string }> = {
  otp: { category: 'Service Implicit', text: 'Your OTP for Herbal Care login is {#var#}. Valid for 5 minutes.' },
  orderSuccess: { category: 'Service Implicit', text: 'Thank you for your order {#var#}. Total: Rs.{#var#}. Track here: {#var#}' },
  orderDispatched: { category: 'Service Implicit', text: 'Your herbal product order {#var#} has been shipped. Delivery expected on {#var#}.' },
  apptConfirmed: { category: 'Service Implicit', text: 'Your booking for {#var#} on {#var#} at {#var#} is confirmed with stylist {#var#}.' },
  apptReminder: { category: 'Service Implicit', text: 'Reminder: Your parlour appointment is scheduled for tomorrow at {#var#}.' },
  invoice: { category: 'Service Implicit', text: 'Thank you for visiting! View your bill of Rs.{#var#} for order {#var#}: {#var#}' },
  backInStock: { category: 'Service Explicit', text: 'Good news! {#var#} is back in stock. Order now before it runs out: {#var#}' },
  lowStock: { category: 'Service Implicit', text: 'Alert: SKU {#var#} is running low. Current balance: {#var#} items.' },
  festival: { category: 'Promotional', text: 'Special Festive Offer! Get {#var#}% off on all herbal facials. Use code {#var#}.' },
}

export interface SmsRecord { id: string; to: string; key: SmsKey; category: DltCategory; text: string; at: string; status: 'Simulated' }

export function renderSms(key: SmsKey, vars: (string | number)[]): string {
  let i = 0
  return SMS_TEMPLATES[key].text.replace(/\{#var#\}/g, () => String(vars[i++] ?? ''))
}

export function sendSms(key: SmsKey, to: string, vars: (string | number)[]): SmsRecord {
  const rec: SmsRecord = { id: uid('sms'), to, key, category: SMS_TEMPLATES[key].category, text: renderSms(key, vars), at: new Date().toISOString(), status: 'Simulated' }
  write(KEYS.sms, [rec, ...read<SmsRecord[]>(KEYS.sms, [])].slice(0, 200))
  return rec
}
export const getOutbox = (): SmsRecord[] => read<SmsRecord[]>(KEYS.sms, [])
