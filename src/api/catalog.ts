// Shared service categories, staff roster and service rules used by booking (CRS 3.4 / 4.4).
// BACKEND: roster -> `staff` table (admin edits it in Phase 4); home-service flags -> `services.home_available` column.
export type Category = 'Body Massage' | 'Facial' | 'Consultation' | 'Bridal Makeup'

export interface Specialist { name: string; role: string; skill: string; img: string; categories: Category[]; homeVisits: boolean }

export const team: Specialist[] = [
  { name: 'Anika', role: 'Lead massage therapist', skill: 'Body massage & aromatherapy', img: 'head-massage', categories: ['Body Massage'], homeVisits: true },
  { name: 'Meera', role: 'Senior therapist', skill: 'Body massage & aromatherapy', img: 'foot-soak', categories: ['Body Massage'], homeVisits: true },
  { name: 'Isha', role: 'Senior beautician', skill: 'Facials & hydra facial', img: 'hydra-facial', categories: ['Facial', 'Consultation', 'Bridal Makeup'], homeVisits: true },
  { name: 'Nisha', role: 'Beauty consultant', skill: 'Skin & beauty consultation', img: 'bridal-saree', categories: ['Consultation', 'Facial', 'Bridal Makeup'], homeVisits: true },
]

/** Services that cannot be done at the customer's home (needs salon equipment). Admin toggles this in Phase 4. */
export const PARLOUR_ONLY_SERVICES: string[] = ['hydra-facial']
export const homeServiceAvailable = (serviceId: string) => !PARLOUR_ONLY_SERVICES.includes(serviceId)
