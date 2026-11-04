export type Country = "ETHIOPIA" | "SOMALIA" | "DJIBOUTI";
export type TruckType = "FLATBED" | "REFRIGERATED" | "TANKER" | "CONTAINER" | "OPEN_BODY" | "MINI_TRUCK";
export type BookingStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED" | "CANCELLED";
export type LoadStatus = "OPEN" | "BOOKED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "DRAFT";

export interface Load {
  id: string;
  title: string;
  description?: string;
  weightTons: number;
  truckTypeNeeded: TruckType;
  pickupCity: string;
  pickupCountry: Country;
  deliveryCity: string;
  deliveryCountry: Country;
  offeredPrice: number;
  currency: string;
  status: LoadStatus;
  scheduledDate?: string;
  createdAt: string;
  sender?: { fullName: string; phone: string };
  _count?: { bids: number };
}

export interface Truck {
  id: string;
  plateNumber: string;
  truckType: TruckType;
  capacityTons: number;
  lengthMeters?: number;
  currentCity: string;
  currentCountry: Country;
  isAvailable: boolean;
  isVerified: boolean;
  driverId?: string;
  driver?: { id: string; fullName: string; phone: string };
  createdAt: string;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  agreedPrice: number;
  currency: string;
  load?: Load;
  truck?: Truck;
  owner?: { fullName: string; phone: string };
  sender?: { fullName: string; phone: string };
  driverId?: string;
  createdAt: string;
}
