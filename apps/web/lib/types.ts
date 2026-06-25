// Shared types for the web app — mirrors apps/api/prisma/schema.prisma.
// Best-effort typing. Replace ad-hoc `any` usage going forward.

export type UserRole = "CARGO_SENDER" | "TRUCK_OWNER" | "DRIVER" | "ADMIN" | "BROKER";

export type UserStatus =
  | "PENDING_VERIFICATION"
  | "DOCUMENTS_SUBMITTED"
  | "ACTIVE"
  | "SUSPENDED"
  | "BANNED";

export type Country = "ETHIOPIA" | "SOMALIA" | "DJIBOUTI";

export type TruckType =
  | "FLATBED"
  | "REFRIGERATED"
  | "TANKER"
  | "CONTAINER"
  | "OPEN_BODY"
  | "MINI_TRUCK";

export type LoadStatus =
  | "DRAFT"
  | "OPEN"
  | "BOOKED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export type BookingStatus =
  | "PENDING"
  | "ACCEPTED"
  | "IN_TRANSIT"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export interface User {
  id: string;
  fullName: string;
  email?: string | null;
  phone: string;
  role: UserRole;
  status: UserStatus | string;
  country?: Country | string;
  city?: string;
  isVerified: boolean;
  phoneVerified?: boolean;
  averageRating?: number | null;
  totalRatings?: number;
  licenseNumber?: string | null;
  preferredLanguage?: "EN" | "AM" | "SO";
}

export interface Load {
  id: string;
  senderId: string;
  sender?: Pick<User, "id" | "fullName" | "phone" | "isVerified"> | null;
  title: string;
  description?: string | null;
  weightTons: number;
  truckTypeNeeded: TruckType;
  pickupCity: string;
  pickupCountry: Country | string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  deliveryCity: string;
  deliveryCountry: Country | string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  offeredPrice: number;
  currency: string;
  status: LoadStatus;
  scheduledDate: string;
  // Broker-posted loads (P3c-2): broker is recorded as senderId, real cargo
  // owner's contact stored here.
  externalOwnerName?: string | null;
  externalOwnerPhone?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Truck {
  id: string;
  ownerId: string;
  owner?: Pick<User, "id" | "fullName" | "phone" | "isVerified"> | null;
  plateNumber: string;
  truckType: TruckType;
  capacityTons: number;
  lengthMeters?: number | null;
  photoUrl?: string | null;
  isAvailable: boolean;
  isVerified: boolean;
  currentCity: string;
  currentCountry: Country | string;
  driverId?: string | null;
  driver?: Pick<User, "id" | "fullName" | "phone" | "licenseNumber"> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  loadId: string;
  load?: Load | null;
  truckId: string;
  truck?: Truck | null;
  senderId: string;
  sender?: Pick<User, "id" | "fullName" | "phone"> | null;
  ownerId: string;
  owner?: Pick<User, "id" | "fullName" | "phone" | "isVerified"> | null;
  driverId?: string | null;
  driver?: Pick<User, "id" | "fullName" | "phone"> | null;
  // Broker dispatch (P1): records which broker created this booking.
  brokerId?: string | null;
  status: BookingStatus;
  agreedPrice: number;
  currency: string;
  // Broker money ledger (P5a) — record-only, set by the broker after collecting
  // cash from sender / paying truck owner offline.
  brokerCutAmount?: number | null;
  ownerPayoutAmount?: number | null;
  brokerCollectedAt?: string | null;
  ownerPaidOutAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  senderRating?: number | null;
  ownerRating?: number | null;
  senderComment?: string | null;
  ownerComment?: string | null;
  createdAt: string;
  updatedAt: string;
}
