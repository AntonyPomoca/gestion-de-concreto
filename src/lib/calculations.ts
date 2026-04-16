import { differenceInMinutes, parse } from 'date-fns';
import { Order, Trip } from '../types';

export function calculatePunctuality(scheduledTime: string, arrivalTime: string): { status: 'A tiempo' | 'Atrasado' | 'Pendiente', diffMinutes: number } {
  if (!scheduledTime || !arrivalTime) return { status: 'Pendiente', diffMinutes: 0 };
  
  try {
    const scheduled = parse(scheduledTime, 'HH:mm', new Date());
    const arrival = parse(arrivalTime, 'HH:mm', new Date());
    
    let diffMinutes = differenceInMinutes(arrival, scheduled);
    
    // Si la diferencia es masiva (ej: llegó a la 01:00 programado a las 23:00), 
    // probablemente es un cruce de día.
    if (diffMinutes < -720) diffMinutes += 1440; // +24h
    if (diffMinutes > 720) diffMinutes -= 1440;  // -24h
    
    if (diffMinutes <= 15) {
      return { status: 'A tiempo', diffMinutes };
    } else {
      return { status: 'Atrasado', diffMinutes };
    }
  } catch (e) {
    return { status: 'Pendiente', diffMinutes: 0 };
  }
}

export function calculateCycleTime(startTime: string, returnTime: string): number {
  if (!startTime || !returnTime) return 0;
  
  try {
    const start = parse(startTime, 'HH:mm', new Date());
    const returnT = parse(returnTime, 'HH:mm', new Date());
    
    return differenceInMinutes(returnT, start);
  } catch (e) {
    return 0;
  }
}

export function calculateRequiredTrips(totalVolume: number, unitCapacity: number): number {
  if (!totalVolume || !unitCapacity || unitCapacity <= 0) return 0;
  return Math.ceil(totalVolume / unitCapacity);
}
