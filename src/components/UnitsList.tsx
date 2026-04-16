import { Order } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Truck } from 'lucide-react';
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
        <Truck className="w-5 h-5 text-slate-500" />
        <h2 className="text-xl font-semibold dark:text-slate-100">Listado de Unidades</h2>
      </div>
      
      <div className="rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-300">
        <Table>
          <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
            <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
              <TableHead className="font-medium text-slate-500 dark:text-slate-400">Unidad</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400">Pedidos Asociados</TableHead>
              <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Total Viajes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground dark:text-slate-500">
                  No hay unidades registradas
                </TableCell>
              </TableRow>
            ) : (
              units.map(([unitId, data]) => {
                // Group multicarga trips by arrivalTime to calculate counts and colors
                const mcTrips = data.trips.filter(t => t.isMultiLoad);
                const mcGroups = new Map<string, any[]>();
                mcTrips.forEach(t => {
                  const time = t.arrivalTime || 'pending';
                  const existing = mcGroups.get(time) || [];
                  existing.push(t);
                  mcGroups.set(time, existing);
                });

                const normalTrips = data.trips.filter(t => !t.isMultiLoad);
                const totalTripsCount = normalTrips.length + mcGroups.size;

                return (
                  <TableRow key={unitId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                    <TableCell className="font-bold text-slate-900 dark:text-slate-100">
                      {unitId}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      <div className="flex flex-wrap gap-1">
                        {data.orders.map(order => {
                          const relevantTrip = order.trips.find(t => t.unitId === unitId && t.isMultiLoad);
                          const isMultiLoad = !!relevantTrip;
                          const unitColors = isMultiLoad 
                            ? getUnitColors(unitId, relevantTrip.arrivalTime) 
                            : { badge: '' };

                          return (
                            <Badge 
                              key={order.id} 
                              variant="secondary" 
                              className={`text-[10px] font-normal ${isMultiLoad ? unitColors.badge : ''}`}
                            >
                              {order.orderNumber}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 text-center">
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
