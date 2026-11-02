
export const USERS = [
  { email: 'admin@revathiherbal.demo', password: 'Admin@123', role: 'Admin', name: 'Ananya Iyer', title: 'Operations Head' },
  { email: 'staff@revathiherbal.demo', password: 'Staff@123', role: 'Staff', name: 'Meera Nair', title: 'Front Desk Associate' },
  { email: 'staff2@revathiherbal.demo', password: 'Staff@123', role: 'Staff', name: 'Priya Raman', title: 'Beauty Specialist' },
  { email: 'staff3@revathiherbal.demo', password: 'Staff@123', role: 'Staff', name: 'Karthik Subramani', title: 'Hair Therapist' }
];

export const CATEGORIES = ['Serum', 'Moisturiser', 'Hair Care', 'Perfume', 'Skincare Kit', 'Body Care'];
export const PRODUCT_STATUSES = ['Active', 'Draft', 'Out of Stock'];
export const LOW_STOCK = 10;

const palette = [
  ['#f5e2e6', '#b76e79'],
  ['#f8ebee', '#963f55'],
  ['#f0cdd4', '#96545f'],
  ['#eadde0', '#75666b'],
  ['#fbe3e5', '#c98f98'],
  ['#f3d5da', '#a8586a']
];

export const swatch = (i) => palette[i % palette.length];


// Order pipeline names (same 5 steps the customer sees on the Tracking page).
export const ORDER_STATUSES = ['Order placed', 'Order confirmed', 'Order packed', 'Order shipped', 'Order delivered', 'Cancelled'];
export const PAYMENT_STATUSES = ['Paid', 'Pending', 'Failed'];

// Services come from the Services & Pricing page (site config), nothing is hardcoded here.
import { services as siteServices } from '../../site/data';
export const SERVICES = siteServices.map((s) => ({ name: s.name, duration: s.duration, price: s.price }));

// Admin / staff move an appointment along these steps; the customer's tracking page follows live.
export const APPOINTMENT_STATUSES = ['Pending Review', 'Scheduled', 'Checked-In', 'In Session', 'Completed', 'Rescheduled', 'No-Show', 'Cancelled'];

export const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

const _d = new Date();
export const TODAY = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

export const STAFF_ROLES = ['Administrator', 'Skin Specialist', 'Hair Therapist', 'Beauty Specialist', 'Receptionist', 'Wellness Specialist'];
export const AVAILABILITY = ['Available', 'With Client', 'Off Duty'];
export const LOYALTY_TIERS = ['New', 'Regular', 'Silver', 'Gold', 'VIP'];

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export const initials = (name) =>
  name.replace(/^Dr\.\s*/, '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const DATE_LOCALES = {
  en: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
  ml: 'ml-IN',
  te: 'te-IN'
};

export const fmtDate = (iso, lang = 'en') =>
  new Date(iso + 'T00:00:00').toLocaleDateString(
    DATE_LOCALES[lang] || 'en-IN',
    { day: '2-digit', month: 'short', year: 'numeric' }
  );
