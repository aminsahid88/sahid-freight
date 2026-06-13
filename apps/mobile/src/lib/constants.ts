export const C = {
  primary: '#1B3A2D',
  amber: '#E8A020',
  bg: '#FAFAF8',
  text: '#111111',
  gray: '#6B6B6B',
  border: '#E8E4DC',
  white: '#FFFFFF',
  red: '#DC2626',
  green: '#16A34A',
  blue: '#3D7BFF',
  card: '#FFFFFF',
};

export const API_URL = 'https://sahid-freight-production.up.railway.app';

export const STATUS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  OPEN:       { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Open' },
  BOOKED:     { bg: '#E8F0FF', color: '#3D7BFF', border: '#BBD0FF', label: 'Booked' },
  IN_TRANSIT: { bg: '#FFF7ED', color: '#C2791A', border: '#FED7AA', label: 'In Transit' },
  DELIVERED:  { bg: '#F0FDF4', color: '#15803D', border: '#86EFAC', label: 'Delivered' },
  CANCELLED:  { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Cancelled' },
  DRAFT:      { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB', label: 'Draft' },
  PENDING:    { bg: '#FFF7ED', color: '#E8A020', border: '#FED7AA', label: 'Pending' },
  ACCEPTED:   { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Accepted' },
  REJECTED:   { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', label: 'Rejected' },
  COMPLETED:  { bg: '#E8F0FF', color: '#3D7BFF', border: '#BBD0FF', label: 'Delivered' },
  SUSPENDED:  { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB', label: 'Inactive' },
  ACTIVE:     { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', label: 'Active' },
};

export const TRUCK_TYPES = ['FLATBED','REFRIGERATED','TANKER','CONTAINER','OPEN_BODY','MINI_TRUCK'];
export const COUNTRIES = ['ETHIOPIA','SOMALIA','DJIBOUTI'];
export const CURRENCIES = ['USD','ETB','SOS','DJF'];

export function formatPrice(amount: number | null | undefined, currency?: string): string {
  if (amount == null) return '—';
  const formatted = Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}
