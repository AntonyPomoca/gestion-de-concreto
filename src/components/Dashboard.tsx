import { Order } from '../types';
import { calculatePunctuality, calculateCycleTime } from '../lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Clock, AlertTriangle, CheckCircle, Package, Activity } from 'lucide-react';
import ollaImg from '@/assets/olla.png';

export function Dashboard({ orders }: { orders: Order[] }) {
  const totalOrders = orders.length;
  const totalTrips = orders.reduce((acc, order) => acc + order.trips.length, 0);
  
  let onTimeCount = 0;
  let delayedCount = 0;
  let totalDeliveryTime = 0;
  let totalReturnTime = 0;
  let completedTrips = 0;
  const multicargaOrdersSet = new Set<string>();
  const tripsByUnitAndTime = new Map<string, string[]>();

  orders.forEach(order => {
    order.trips.forEach(trip => {
      if (trip.isMultiLoad) {
        multicargaOrdersSet.add(order.id);
      }
      
      if (trip.unitId && trip.arrivalTime) {
        const key = `${trip.unitId}_${trip.arrivalTime}`;
        const existing = tripsByUnitAndTime.get(key) || [];
        if (!existing.includes(order.id)) {
          existing.push(order.id);
        }
        tripsByUnitAndTime.set(key, existing);
      }
    });
  });

  // Add orders that share a unit and time
  tripsByUnitAndTime.forEach(orderIds => {
    if (orderIds.length > 1) {
      orderIds.forEach(id => multicargaOrdersSet.add(id));
    }
  });

  const multicargaOrders = multicargaOrdersSet.size;

  orders.forEach(order => {
    order.trips.forEach(trip => {
      if (trip.arrivalTime) {
        const { status, diffMinutes } = calculatePunctuality(order.scheduledTime, trip.arrivalTime);
        if (status === 'A tiempo') onTimeCount++;
        if (status === 'Atrasado') delayedCount++;
        totalDeliveryTime += diffMinutes; // This might be negative if early, but let's just use it for average delay
      }
      
      if (trip.arrivalTime && trip.returnTime) {
        totalReturnTime += calculateCycleTime(trip.arrivalTime, trip.returnTime);
        completedTrips++;
      }
    });
  });

  const totalEvaluatedTrips = onTimeCount + delayedCount;
  const onTimePercentage = totalEvaluatedTrips > 0 ? Math.round((onTimeCount / totalEvaluatedTrips) * 100) : 0;
  const delayedPercentage = totalEvaluatedTrips > 0 ? Math.round((delayedCount / totalEvaluatedTrips) * 100) : 0;
  
  const avgReturnTime = completedTrips > 0 ? Math.round(totalReturnTime / completedTrips) : 0;

  const uniqueUnits = new Set();
  orders.forEach(order => {
    order.trips.forEach(trip => {
      if (trip.unitId) uniqueUnits.add(trip.unitId);
    });
  });
  const totalUniqueUnits = uniqueUnits.size;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400">Total Pedidos</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground dark:text-slate-400" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-light dark:text-slate-100">{totalOrders}</div>
          <p className="text-xs text-muted-foreground mt-1 dark:text-slate-400">
            {multicargaOrders} pedidos con multicarga
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400">Unidades Utilizadas</CardTitle>
          <img src={ollaImg} alt="Olla" className="h-5 w-5 object-contain opacity-70 invert dark:invert-0" referrerPolicy="no-referrer" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-light dark:text-slate-100">{totalUniqueUnits}</div>
          <p className="text-xs text-muted-foreground mt-1 dark:text-slate-400">
            Unidades activas hoy
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400">Puntualidad</CardTitle>
          <CheckCircle className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-light text-emerald-600 dark:text-emerald-400">{onTimePercentage}%</div>
          <p className="text-xs text-muted-foreground mt-1 dark:text-slate-400">
            Entregas a tiempo (±15 min)
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400">Atrasos</CardTitle>
          <AlertTriangle className="h-4 w-4 text-rose-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-light text-rose-600 dark:text-rose-400">{delayedPercentage}%</div>
          <p className="text-xs text-muted-foreground mt-1 dark:text-slate-400">
            Entregas fuera de tiempo
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm border-0 bg-white dark:bg-slate-900 dark:border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground dark:text-slate-400">Tiempo Promedio en Obra</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground dark:text-slate-400" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-light dark:text-slate-100">{avgReturnTime} <span className="text-lg">min</span></div>
          <p className="text-xs text-muted-foreground mt-1 dark:text-slate-400">
            Ciclo en obra (Llegada - Salida)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
