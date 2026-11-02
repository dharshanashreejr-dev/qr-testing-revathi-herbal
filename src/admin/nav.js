import {
  LayoutDashboard, Package, ShoppingBag, CalendarDays, Users, Boxes, BarChart3, UserCog, Sparkles, Star,
  Receipt, Shield, Gift, Clock, Wallet, Fingerprint, CalendarOff, CalendarRange
} from 'lucide-react';

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Staff'] },
  { id: 'pos', label: 'POS Billing', icon: Receipt, roles: ['Admin'] },
  { id: 'products', label: 'Products', icon: Package, roles: ['Admin'] },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, roles: ['Admin', 'Staff'] },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays, roles: ['Admin', 'Staff'] },
  { id: 'customers', label: 'Customers & CRM', icon: Users, roles: ['Admin'] },
  { id: 'inventory', label: 'Inventory', icon: Boxes, roles: ['Admin', 'Staff'] },
  { id: 'services', label: 'Services & Pricing', icon: Sparkles, roles: ['Admin'] },
  { id: 'offers', label: 'Festival & Offers', icon: Gift, roles: ['Admin'] },
  { id: 'reviews', label: 'Reviews', icon: Star, roles: ['Admin'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['Admin'] },
  // HR
  { id: 'attendance', label: 'Attendance', icon: Clock, roles: ['Admin', 'Staff'] },
  { id: 'shifts', label: 'Shifts & Roster', icon: CalendarRange, roles: ['Admin', 'Staff'] },
  { id: 'leave', label: 'Leave & Holidays', icon: CalendarOff, roles: ['Admin', 'Staff'] },
  { id: 'payroll', label: 'Payroll', icon: Wallet, roles: ['Admin', 'Staff'] },
  { id: 'devices', label: 'Device Settings', icon: Fingerprint, roles: ['Admin'] },
  { id: 'staff', label: 'Staff Management', icon: UserCog, roles: ['Admin'] },
  { id: 'audit', label: 'Audit log', icon: Shield, roles: ['Admin'] }
];

export const canAccess = (role, id) => !!NAV.find((n) => n.id === id && n.roles.includes(role));
