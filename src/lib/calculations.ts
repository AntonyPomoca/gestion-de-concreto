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

export function calculateTimeDiff(time1: string, time2: string): number {
  if (!time1 || !time2) return 0;
  try {
    const t1 = parse(time1, 'HH:mm', new Date());
    const t2 = parse(time2, 'HH:mm', new Date());
    return differenceInMinutes(t2, t1);
  } catch (e) {
    return 0;
  }
}

export function formatTimeAMPM(timeStr: string | undefined | null): string {
  if (!timeStr) return '';
  try {
    const d = parse(timeStr, 'HH:mm', new Date());
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch (e) {
    return timeStr;
  }
}

export function formatDuration(totalMinutes: number): string {

  if (totalMinutes <= 0) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes} min`;
}
