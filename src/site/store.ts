// Phase 3: bookings now live in the shared data layer (src/api/booking.ts). This file only re-exports it so existing
// imports keep working. New code should use `api.booking` / import from '../api/booking'.
export * from '../api/booking'
