import { Order } from '../types';
import { calculateCycleTime, calculateTimeDiff, formatDuration } from '../lib/calculations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { getUnitColors } from '../lib/utils';

export function UnitsList({ orders }: { orders: Order[] }) {
  // Group orders by unitId
  const unitsMap = new Map<string, { orders: Order[], trips: any[] }>();
  
  orders.forEach(order => {
    order.trips.forEach(trip => {
      if (trip.unitId) {
        const existing = unitsMap.get(trip.unitId) || { orders: [], trips: [] };
        if (!existing.orders.find(o => o.id === order.id)) {
          existing.orders.push(order);
        }
        existing.trips.push(trip);
        unitsMap.set(trip.unitId, existing);
      }
    });
  });

  const units = Array.from(unitsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <h2 className="text-xl font-semibold dark:text-slate-100">Listado de Unidades</h2>
      </div>
      
      <div className="rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-300">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
            <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
              <TableHead className="font-medium text-slate-500 dark:text-slate-400">Unidad</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400">Pedido</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Horario (Obra)</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Tiempo en Obra</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Total Viajes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground dark:text-slate-500">
                  No hay unidades registradas
                </TableCell>
              </TableRow>
            ) : (
              units.map(([unitId, data]) => {
                // Filter out empty trips that have no arrival time so they don't bloat the counts if they are completely unstarted
                const startedTrips = data.trips.filter((t: any) => t.arrivalTime);

                // Group multicarga trips by arrivalTime to calculate counts and colors
                const mcTrips = startedTrips.filter((t: any) => t.isMultiLoad);
                const mcGroups = new Map<string, any[]>();
                mcTrips.forEach((t: any) => {
                  const time = t.arrivalTime || 'pending';
                  const existing = mcGroups.get(time) || [];
                  existing.push(t);
                  mcGroups.set(time, existing);
                });

                const normalTrips = startedTrips.filter((t: any) => !t.isMultiLoad);
                const totalTripsCount = normalTrips.length + mcGroups.size;

                // Pre-calculate all trip details for consistent row rendering
                const tripsInfo = startedTrips.map((trip: any) => {
                  const cycle = (trip.arrivalTime && trip.returnTime) ? calculateCycleTime(trip.arrivalTime, trip.returnTime) : null;
                  
                  const relevantOrder = orders.find(o => o.id === trip.orderId);
                  const orderNum = relevantOrder ? relevantOrder.orderNumber : '...';
                  const elementToPour = relevantOrder?.elementToPour || '';

                  let arrivalInterval = null;
                  if (relevantOrder && trip.arrivalTime) {
                    const orderTripsSorted = [...relevantOrder.trips]
                      .filter(t => t.arrivalTime)
                      .sort((a, b) => (a.arrivalTime || '').localeCompare(b.arrivalTime || ''));
                    
                    const currentTripIdx = orderTripsSorted.findIndex(t => t.id === trip.id);
                    if (currentTripIdx > 0) {
                      const prevOrderTrip = orderTripsSorted[currentTripIdx - 1];
                      arrivalInterval = calculateTimeDiff(prevOrderTrip.arrivalTime!, trip.arrivalTime!);
                    }
                  }

                  return { trip, cycle, orderNum, arrivalInterval, elementToPour };
                });

                return (
                  <TableRow key={unitId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                    <TableCell className="font-bold text-slate-900 dark:text-slate-100 py-4">
                        {unitId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2 py-1">
                        {tripsInfo.map((info: any, idx) => {
                          const isMC = info.trip.isMultiLoad;
                          const mcColors = isMC ? getUnitColors(info.trip.unitId, info.trip.arrivalTime) : null;
                          return (
                            <div key={idx} className="h-8 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                #{info.orderNum} {info.elementToPour ? `- ${info.elementToPour}` : ''}
                              </span>
                              {isMC && mcColors && (
                                <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 ${mcColors.badge}`}>
                                  MC
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-2 py-1 items-center">
                        {tripsInfo.map((info: any, idx) => (
                          <div key={idx} className="h-8 flex items-center justify-center bg-slate-50/10 dark:bg-slate-950/30 px-2 rounded-lg border border-slate-100 dark:border-slate-800 min-w-[110px]">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              {info.trip.arrivalTime} → {info.trip.returnTime || '...'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-2 py-1 items-center">
                        {tripsInfo.map((info: any, idx) => (
                          <div key={idx} className="h-8 flex items-center">
                            {info.trip.isNonCompliant ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-bold border-rose-200 dark:border-rose-900 bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                                Incumplimiento
                              </Badge>
                            ) : info.cycle !== null ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-bold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                {formatDuration(info.cycle)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-slate-400 border-slate-100 bg-transparent dark:border-slate-800">
                                En obra
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 text-center font-bold">
                      {totalTripsCount}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
