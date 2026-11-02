// Price & discount columns (CRS 4.1): MRP / base price, discount type (flat or percentage), effective selling price.
export type DiscountType = 'flat' | 'percent'
export const effectivePrice = (mrp: number, type: DiscountType, value: number) =>
  Math.max(0, Math.round(type === 'percent' ? mrp - (mrp * value) / 100 : mrp - value))
// CGST / SGST split for the invoice (Phase 5): the GST rate is split equally between the two.
export const gstSplit = (amount: number, ratePct: number) => { const g = (amount * ratePct) / (100 + ratePct); return { net: +(amount - g).toFixed(2), cgst: +(g / 2).toFixed(2), sgst: +(g / 2).toFixed(2) } }
