import { Order } from '../types';
import { calculatePunctuality, calculateCycleTime, calculateTimeDiff, formatDuration } from '../lib/calculations';
import { getUnitColors } from '../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Edit, Trash2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OrdersListProps {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDelete: (id: string) => void;
}

export function OrdersList({ orders, onEdit, onDelete }: OrdersListProps) {
  return (
    <div className="rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-300">
      <Table>
        <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
          <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
            <TableHead className="font-medium text-slate-500 dark:text-slate-400">Pedido</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400">Elem. Colar</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Fecha</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Prog.</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Vol. Sol.</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Vol. Real</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Estado</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Desc. Promedio</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Frec. Llegada</TableHead>
            <TableHead className="font-medium text-slate-500 dark:text-slate-400 text-center">Obs.</TableHead>
            <TableHead className="text-right font-medium text-slate-500 dark:text-slate-400">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-12 text-muted-foreground dark:text-slate-500">
                No hay pedidos registrados
              </TableCell>
            </TableRow>
          ) : (
            orders.map(order => {
              // Calculate overall status based on first trip or worst trip
              let status: 'A tiempo' | 'Atrasado' | 'Cancelado' | 'Pendiente' = order.status || 'A tiempo';
              let totalCycle = 0;
              let completedTrips = 0;
              let avgInterval = 0;

              if (status !== 'Cancelado') {
                let hasArrival = false;
                let hasMultiLoad = false;
                
                // Sort trips by time to get the "first" one
                const validTrips = [...order.trips].filter(t => t.arrivalTime).sort((a, b) => a.arrivalTime!.localeCompare(b.arrivalTime!));
                const firstTripWithArrival = validTrips[0];
                
                if (firstTripWithArrival) {
                  hasArrival = true;
                  const s = calculatePunctuality(order.scheduledTime, firstTripWithArrival.arrivalTime!).status;
                  status = s;
                } else {
                  status = 'Pendiente';
                }

                // Still process all trips for cycle times
                order.trips.forEach(trip => {
                  if (trip.isMultiLoad) hasMultiLoad = true;
                  if (trip.arrivalTime && trip.returnTime) {
                    totalCycle += calculateCycleTime(trip.arrivalTime, trip.returnTime);
                    completedTrips++;
                  }
                });
                
                if (validTrips.length > 1) {
                  let totalInterval = 0;
                  for (let i = 1; i < validTrips.length; i++) {
                    totalInterval += calculateTimeDiff(validTrips[i-1].arrivalTime!, validTrips[i].arrivalTime!);
                  }
                  avgInterval = Math.round(totalInterval / (validTrips.length - 1));
                }
              }

              const avgCycle = completedTrips > 0 ? Math.round(totalCycle / completedTrips) : 0;
              const displayStatus: string = status;
              const hasMultiLoad = order.trips.some(t => t.isMultiLoad);
              const firstMultiTrip = order.trips.find(t => t.isMultiLoad);
              const unitColors = hasMultiLoad && firstMultiTrip 
                ? getUnitColors(firstMultiTrip.unitId, firstMultiTrip.arrivalTime) 
                : { border: '', badge: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800', row: '' };

              return (
                <TableRow key={order.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800 ${status === 'Cancelado' ? 'bg-rose-50/30 dark:bg-rose-900/10' : unitColors.row} ${unitColors.border}`}>
                  <TableCell className="font-medium dark:text-slate-200">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        {order.orderNumber}
                        {hasMultiLoad && (
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${unitColors.badge}`}>
                            MC
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 min-w-[120px] max-w-[200px]">
                    <div className="whitespace-normal break-words line-clamp-2 hover:line-clamp-none transition-all">
                      {order.elementToPour || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-center whitespace-nowrap">{order.orderDate}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-center whitespace-nowrap">{order.scheduledTime} hrs</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-center whitespace-nowrap">{order.requestedVolume} m³</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-center whitespace-nowrap">{order.actualVolume} m³</TableCell>
                  <TableCell className="text-center">
                    {displayStatus === 'Pendiente' ? (
                      <span className="text-slate-400 dark:text-slate-500 font-medium">-</span>
                    ) : (
                      <Badge variant={displayStatus === 'A tiempo' ? 'success' : displayStatus === 'Atrasado' ? 'warning' : displayStatus === 'Cancelado' ? 'destructive' : 'secondary'} className="font-normal">
                        {displayStatus}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-center whitespace-nowrap">
                    {avgCycle > 0 ? formatDuration(avgCycle) : '-'}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 font-medium text-center whitespace-nowrap">
                    {avgInterval > 0 ? (
                      <span className="text-blue-600 dark:text-blue-400 text-xs">+{formatDuration(avgInterval)}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {order.customerComments && order.customerComments.trim() !== '' && (
                      <div className="relative inline-block group">
                        <div className="inline-flex items-center justify-center cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        {/* Tooltip mejorado con posicionamiento relativo al ancho de pantalla */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[100]">
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl min-w-[200px] max-w-[320px] text-left whitespace-normal break-words"
                          >
                            {order.customerComments}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                          </motion.div>
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(order)} className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400" onClick={() => onDelete(order.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
