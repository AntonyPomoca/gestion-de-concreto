import React, { useState } from 'react';
import { Order, Trip } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, Trash2 } from 'lucide-react';

interface OrderFormProps {
  initialData?: Order;
  onSubmit: (order: Order) => void;
  onCancel: () => void;
}

type OrderFormData = Omit<Order, 'requestedVolume' | 'actualVolume' | 'unitCapacity'> & {
  requestedVolume: number | string;
  actualVolume: number | string;
  unitCapacity: number | string;
};

export function OrderForm({ initialData, onSubmit, onCancel }: OrderFormProps) {
  const [order, setOrder] = useState<OrderFormData>(() => {
    const baseData = initialData || {
      id: Math.random().toString(36).substring(2, 15),
      orderNumber: '',
      orderDate: new Date().toISOString().split('T')[0],
      scheduledTime: '',
      requestedVolume: '',
      actualVolume: '',
      unitCapacity: 8,
      trips: [],
      status: undefined,
      clientName: '',
      commercialProduct: '',
      technicalDescription: '',
      elementToPour: '',
      unloadingMethod: '',
      frequency: '',
      customerComments: '',
      responsible: ''
    };

    // Ensure all trips have at least 'CR' as unitId
    if (baseData.trips && baseData.trips.length > 0) {
      baseData.trips = baseData.trips.map(trip => ({
        ...trip,
        unitId: trip.unitId ? (trip.unitId.toUpperCase().startsWith('CR') ? trip.unitId : 'CR' + trip.unitId) : 'CR'
      }));
    }

    return {
      ...baseData,
      requestedVolume: initialData ? (initialData.requestedVolume === 0 ? '' : initialData.requestedVolume) : '',
      actualVolume: initialData ? (initialData.actualVolume === 0 ? '' : initialData.actualVolume) : '',
      unitCapacity: initialData ? (initialData.unitCapacity === 0 ? '' : initialData.unitCapacity) : 8,
    };
  });

  const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setOrder(prev => {
      const isNumericField = ['requestedVolume', 'actualVolume', 'unitCapacity'].includes(name);
      const newValue = isNumericField ? value : value;
      
      return { ...prev, [name]: newValue };
    });
  };

  const handleTripChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value, type, checked } = e.target;
    
    if (name === 'unitId') {
      let stripped = value;
      if (stripped.toUpperCase().startsWith('CR')) {
        stripped = stripped.substring(2);
      } else if (stripped.toUpperCase().startsWith('C') || stripped.toUpperCase().startsWith('R')) {
        stripped = stripped.substring(1);
        if (stripped.toUpperCase().startsWith('R')) {
          stripped = stripped.substring(1);
        }
      }
      value = 'CR' + stripped;
    }

    setOrder(prev => {
      const newTrips = [...prev.trips];
      newTrips[index] = { ...newTrips[index], [name]: type === 'checkbox' ? checked : value };
      return { ...prev, trips: newTrips };
    });
  };

  const addTrip = () => {
    setOrder(prev => ({
      ...prev,
      trips: [
        ...prev.trips,
        {
          id: Math.random().toString(36).substring(2, 15),
          orderId: prev.id,
          unitId: 'CR',
          arrivalTime: '',
          returnTime: ''
        }
      ]
    }));
  };

  const removeTrip = (index: number) => {
    setOrder(prev => ({
      ...prev,
      trips: prev.trips.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalOrder: Order = {
      ...order,
      requestedVolume: parseFloat(order.requestedVolume as string) || 0,
      actualVolume: parseFloat(order.actualVolume as string) || 0,
      unitCapacity: parseFloat(order.unitCapacity as string) || 0,
    };
    onSubmit(finalOrder);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-8">
      <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Información General</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
          <div className="space-y-2">
            <Label htmlFor="orderNumber" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Número de Pedido</Label>
            <Input id="orderNumber" name="orderNumber" value={order.orderNumber || ''} onChange={handleOrderChange} required className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-slate-900 dark:focus:ring-slate-400" placeholder="Ej: 8217..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orderDate" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Fecha</Label>
            <Input type="date" id="orderDate" name="orderDate" value={order.orderDate || ''} onChange={handleOrderChange} required className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduledTime" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hora Programada</Label>
            <Input type="time" id="scheduledTime" name="scheduledTime" value={order.scheduledTime || ''} onChange={handleOrderChange} required className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="requestedVolume" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Volumen Solicitado (m³)</Label>
            <Input type="number" step="0.5" id="requestedVolume" name="requestedVolume" value={order.requestedVolume} onChange={handleOrderChange} required className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actualVolume" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Volumen Real (m³)</Label>
            <Input type="number" step="0.5" id="actualVolume" name="actualVolume" value={order.actualVolume} onChange={handleOrderChange} required className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unitCapacity" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Capacidad Unidad (m³)</Label>
            <Input type="number" step="0.5" id="unitCapacity" name="unitCapacity" value={order.unitCapacity} onChange={handleOrderChange} required className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
        </div>
      </div>

      <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Detalles del Pedido</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label htmlFor="clientName" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ubicación</Label>
            <Input id="clientName" name="clientName" value={order.clientName || ''} onChange={handleOrderChange} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" placeholder="Nombre de la ubicación" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commercialProduct" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Prod. Comercial</Label>
            <Input id="commercialProduct" name="commercialProduct" value={order.commercialProduct || ''} onChange={handleOrderChange} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="technicalDescription" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Desc. Técnica</Label>
            <Input id="technicalDescription" name="technicalDescription" value={order.technicalDescription || ''} onChange={handleOrderChange} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="elementToPour" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Elem. a colar</Label>
            <Input id="elementToPour" name="elementToPour" value={order.elementToPour || ''} onChange={handleOrderChange} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unloadingMethod" className="text-sm font-semibold text-slate-700 dark:text-slate-300">M. Descarga</Label>
            <Input id="unloadingMethod" name="unloadingMethod" value={order.unloadingMethod || ''} onChange={handleOrderChange} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="frequency" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Frecuencia</Label>
            <Input id="frequency" name="frequency" value={order.frequency || ''} onChange={handleOrderChange} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsible" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Responsable</Label>
            <Input id="responsible" name="responsible" value={order.responsible || ''} onChange={handleOrderChange} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-2 lg:col-span-4">
            <Label htmlFor="customerComments" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Comentarios Cliente</Label>
            <Input id="customerComments" name="customerComments" value={order.customerComments || ''} onChange={handleOrderChange} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Control de Viajes</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Registre cada unidad y sus tiempos de ciclo</p>
          </div>
          <Button type="button" variant="outline" onClick={addTrip} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
            <Plus className="w-4 h-4 mr-2" /> Agregar Viaje
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {order.trips.map((trip, index) => (
            <div key={trip.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl relative bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs">
                    {index + 1}
                  </span>
                  Viaje / Unidad
                </h4>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-rose-500 h-8 w-8"
                  onClick={() => removeTrip(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID Unidad / Camión</Label>
                  <Input name="unitId" value={trip.unitId || 'CR'} onChange={(e) => handleTripChange(index, e)} required className="bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" placeholder="CR6022" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Llegada a Obra</Label>
                  <Input type="time" name="arrivalTime" value={trip.arrivalTime || ''} onChange={(e) => handleTripChange(index, e)} className="bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Salida de Obra</Label>
                  <Input type="time" name="returnTime" value={trip.returnTime || ''} onChange={(e) => handleTripChange(index, e)} className="bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      name="isMultiLoad" 
                      checked={trip.isMultiLoad || false} 
                      onChange={(e) => handleTripChange(index, e)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-slate-900 dark:focus:ring-slate-400"
                    />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">Multicarga</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
            Cerrar
          </Button>
          {initialData && (
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setOrder(prev => ({ ...prev, status: prev.status === 'Cancelado' ? undefined : 'Cancelado' }))}
              className={`border-rose-200 dark:border-rose-900 ${order.status === 'Cancelado' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'}`}
            >
              {order.status === 'Cancelado' ? 'Reactivar Pedido' : 'Cancelar Pedido'}
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 px-8">
          {initialData ? 'Actualizar Pedido' : 'Guardar Pedido'}
        </Button>
      </div>
    </form>
  );
}
