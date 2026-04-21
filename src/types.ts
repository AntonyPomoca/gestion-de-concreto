export interface Trip {
  id: string;
  orderId: string;
  unitId: string;
  arrivalTime: string; // HH:mm
  returnTime: string; // HH:mm
  isMultiLoad?: boolean;
  isNonCompliant?: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  requestedVolume: number;
  actualVolume: number;
  unitCapacity: number;
  trips: Trip[];
  status?: 'A tiempo' | 'Atrasado' | 'Cancelado';
  clientName?: string;
  commercialProduct?: string;
  technicalDescription?: string;
  elementToPour?: string;
  unloadingMethod?: string;
  frequency?: string;
  customerComments?: string;
  responsible?: string;
}
