import React, { useEffect, useState, useRef } from 'react';
import { Order } from './types';
import { api } from './services/api';
import { calculatePunctuality } from './lib/calculations';
import { Dashboard } from './components/Dashboard';
import { OrdersList } from './components/OrdersList';
import { UnitsList } from './components/UnitsList';
import { OrderForm } from './components/OrderForm';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Download, Upload, Plus, Trash2, LogOut, User } from 'lucide-react';
import ExcelJS from 'exceljs';
import { ThemeToggle } from './components/ThemeToggle';
import { auth, logout } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { LoginView } from './components/LoginView';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterOrderNumber, setFilterOrderNumber] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterMultiLoad, setFilterMultiLoad] = useState('Todos');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOrders = async () => {
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (error) {
      toast.error('Error al cargar pedidos');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    fetch('/api/test')
      .then(res => res.json())
      .then(data => console.log("API Test:", data))
      .catch(err => console.error("API Test Error:", err));
    
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthReady && user) {
      loadOrders();
    }
  }, [isAuthReady, user]);

  const filteredOrders = orders.filter(order => {
    if (filterDate) {
      const orderDateNormalized = order.orderDate.includes('T') ? order.orderDate.split('T')[0] : order.orderDate;
      if (orderDateNormalized !== filterDate && !order.orderDate.includes(filterDate)) return false;
    }
    if (filterOrderNumber && !order.orderNumber.toLowerCase().includes(filterOrderNumber.toLowerCase())) return false;
    
    if (filterStatus !== 'Todos') {
      let status = order.status || 'A tiempo';
      if (status !== 'Cancelado') {
        let hasDelay = false;
        order.trips.forEach(trip => {
          if (trip.arrivalTime) {
            const s = calculatePunctuality(order.scheduledTime, trip.arrivalTime).status;
            if (s === 'Atrasado') hasDelay = true;
          }
        });
        if (hasDelay) status = 'Atrasado';
      }
      if (status !== filterStatus) return false;
    }

    if (filterMultiLoad !== 'Todos') {
      const hasMultiLoad = order.trips.some(t => t.isMultiLoad);
      if (filterMultiLoad === 'Si' && !hasMultiLoad) return false;
      if (filterMultiLoad === 'No' && hasMultiLoad) return false;
    }
    
    return true;
  }).sort((a, b) => {
    if (filterMultiLoad === 'Si') {
      const unitA = a.trips.find(t => t.unitId)?.unitId || '';
      const unitB = b.trips.find(t => t.unitId)?.unitId || '';
      if (unitA !== unitB) {
        return unitA.localeCompare(unitB);
      }
      // If same unit, sort by scheduled time
      return a.scheduledTime.localeCompare(b.scheduledTime);
    }
    // Default sort by date and time descending
    const dateA = new Date(`${a.orderDate}T${a.scheduledTime || '00:00'}`).getTime();
    const dateB = new Date(`${b.orderDate}T${b.scheduledTime || '00:00'}`).getTime();
    return dateB - dateA; // Newest first
  });

  const handleSaveOrder = async (order: Order) => {
    try {
      if (editingOrder) {
        await api.updateOrder(order);
        toast.success('Pedido actualizado');
      } else {
        await api.createOrder(order);
        toast.success('Pedido creado');
      }
      setIsFormOpen(false);
      setEditingOrder(undefined);
      loadOrders();
    } catch (error) {
      toast.error('Error al guardar pedido');
    }
  };

  const handleDeleteOrder = (id: string) => {
    setOrderToDelete(id);
  };

  const confirmDeleteOrder = async () => {
    if (orderToDelete) {
      try {
        await api.deleteOrder(orderToDelete);
        toast.success('Pedido eliminado');
        loadOrders();
      } catch (error) {
        toast.error('Error al eliminar pedido');
      } finally {
        setOrderToDelete(null);
      }
    }
  };

  const confirmDeleteAll = async () => {
    try {
      await api.deleteAllOrders(filterDate || undefined);
      if (filterDate) {
        toast.success(`Registros del día ${filterDate} eliminados`);
      } else {
        toast.success('Todos los registros han sido eliminados');
      }
      loadOrders();
    } catch (error) {
      toast.error('Error al eliminar los registros');
    } finally {
      setIsDeleteAllOpen(false);
    }
  };

  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    
    // Resumen Sheet
    const summarySheet = workbook.addWorksheet('Resumen');
    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 30 },
      { header: 'Valor', key: 'value', width: 15 }
    ];
    summarySheet.addRow({ metric: 'Total Pedidos', value: orders.length });
    summarySheet.addRow({ metric: 'Total Viajes', value: orders.reduce((acc, o) => acc + o.trips.length, 0) });
    
    // Pedidos Sheet
    const ordersSheet = workbook.addWorksheet('Pedidos');
    ordersSheet.columns = [
      { header: 'Número de Pedido', key: 'orderNumber', width: 20 },
      { header: 'Fecha', key: 'orderDate', width: 15 },
      { header: 'Hora Programada', key: 'scheduledTime', width: 15 },
      { header: 'Ubicación', key: 'clientName', width: 25 },
      { header: 'Prod. Comercial', key: 'commercialProduct', width: 20 },
      { header: 'Desc. Técnica', key: 'technicalDescription', width: 25 },
      { header: 'Elem. a colar', key: 'elementToPour', width: 20 },
      { header: 'M. Descarga', key: 'unloadingMethod', width: 20 },
      { header: 'Frecuencia', key: 'frequency', width: 15 },
      { header: 'Comentarios Cliente', key: 'customerComments', width: 30 },
      { header: 'Responsable', key: 'responsible', width: 20 },
      { header: 'Volumen Solicitado', key: 'requestedVolume', width: 15 },
      { header: 'Volumen Real', key: 'actualVolume', width: 15 },
      { header: 'Capacidad Unidad', key: 'unitCapacity', width: 15 },
      { header: 'Total Viajes', key: 'totalTrips', width: 15 }
    ];
    
    // Unidades Sheet
    const unitsSheet = workbook.addWorksheet('Unidades');
    unitsSheet.columns = [
      { header: 'Número de Pedido', key: 'orderNumber', width: 20 },
      { header: 'ID Unidad', key: 'unitId', width: 15 },
      { header: 'Llegada Obra', key: 'arrivalTime', width: 15 },
      { header: 'Salida Obra', key: 'returnTime', width: 15 }
    ];

    orders.forEach(order => {
      ordersSheet.addRow({
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        scheduledTime: order.scheduledTime,
        clientName: order.clientName,
        commercialProduct: order.commercialProduct,
        technicalDescription: order.technicalDescription,
        elementToPour: order.elementToPour,
        unloadingMethod: order.unloadingMethod,
        frequency: order.frequency,
        customerComments: order.customerComments,
        responsible: order.responsible,
        requestedVolume: order.requestedVolume,
        actualVolume: order.actualVolume,
        unitCapacity: order.unitCapacity,
        totalTrips: order.trips.length
      });

      order.trips.forEach(trip => {
        unitsSheet.addRow({
          orderNumber: order.orderNumber,
          unitId: trip.unitId,
          arrivalTime: trip.arrivalTime,
          returnTime: trip.returnTime
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Reporte_Concreto.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side check for .xls
    if (file.name.toLowerCase().endsWith('.xls') && !file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('El formato .xls no es compatible. Por favor, guarde el archivo como .xlsx (Excel moderno) e intente de nuevo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImporting(true);
    try {
      const res = await api.importExcel(file);
      toast.success(res.message || 'Datos importados correctamente');
      loadOrders();
    } catch (error: any) {
      console.error("Import error details:", error);
      toast.error(error.message || 'Error al importar archivo');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-slate-50"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginView />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors duration-300">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                    <User className="text-slate-400" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Hola, {user.displayName?.split(' ')[0]}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Gestión de Concreto</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <ThemeToggle />
              <Button variant="ghost" onClick={logout} className="text-slate-500 hover:text-rose-500">
                <LogOut className="w-4 h-4 mr-2" /> Salir
              </Button>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden md:block"></div>
              <input 
                type="file" 
                accept=".xlsx,.csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImport}
              />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing} className="dark:bg-slate-900 dark:border-slate-800">
              <Upload className="w-4 h-4 mr-2" /> {importing ? 'Importando...' : 'Importar'}
            </Button>
            <Button variant="outline" onClick={handleExport} className="dark:bg-slate-900 dark:border-slate-800">
              <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteAllOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> {filterDate ? `Borrar Día ${filterDate}` : 'Borrar Todo'}
            </Button>
            <Button onClick={() => { setEditingOrder(undefined); setIsFormOpen(true); }} className="dark:bg-slate-50 dark:text-slate-900">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Pedido
            </Button>
          </div>
        </div>

        <Dashboard orders={filteredOrders} />

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-semibold dark:text-slate-100">Listado de Pedidos</h2>
            <div className="flex flex-wrap gap-2">
              <input 
                type="text" 
                placeholder="Buscar por número..." 
                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:focus:ring-slate-400"
                value={filterOrderNumber}
                onChange={(e) => setFilterOrderNumber(e.target.value)}
              />
              <input 
                type="date" 
                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:focus:ring-slate-400"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              <select 
                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:focus:ring-slate-400"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="Todos">Todos los estados</option>
                <option value="A tiempo">A tiempo</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
              <select 
                className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:focus:ring-slate-400"
                value={filterMultiLoad}
                onChange={(e) => setFilterMultiLoad(e.target.value)}
              >
                <option value="Todos">Multicarga: Todos</option>
                <option value="Si">Solo Multicarga</option>
                <option value="No">Sin Multicarga</option>
              </select>
            </div>
          </div>
          <OrdersList 
            orders={filteredOrders} 
            onEdit={(order) => { setEditingOrder(order); setIsFormOpen(true); }}
            onDelete={handleDeleteOrder}
          />
        </div>

        <div className="mt-12">
          <UnitsList orders={filteredOrders} />
        </div>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="sm:max-w-none w-[95vw] lg:w-[90vw] xl:w-[1400px] h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-2xl">{editingOrder ? 'Editar Pedido' : 'Nuevo Pedido'}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-2">
              <OrderForm 
                initialData={editingOrder} 
                onSubmit={handleSaveOrder} 
                onCancel={() => setIsFormOpen(false)} 
              />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar eliminación</DialogTitle>
              <DialogDescription>
                ¿Está seguro de que desea eliminar este pedido? Esta acción no se puede deshacer y eliminará también todos los viajes asociados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setOrderToDelete(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteOrder}>Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{filterDate ? `Borrar registros del día ${filterDate}` : 'Borrar todos los registros'}</DialogTitle>
              <DialogDescription>
                {filterDate 
                  ? `¿Está seguro de que desea eliminar todos los pedidos y viajes del día ${filterDate}? Esta acción no se puede deshacer.`
                  : '¿Está seguro de que desea eliminar todos los pedidos y viajes registrados? Esta acción no se puede deshacer y dejará el sistema en blanco.'
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsDeleteAllOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDeleteAll}>
                {filterDate ? 'Sí, borrar día' : 'Sí, borrar todo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Toaster />
    </div>
  );
}
