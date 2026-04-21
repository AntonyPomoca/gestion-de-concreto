import React, { useEffect, useState, useRef } from 'react';
import { Order } from './types';
import { api } from './services/api';
import { calculatePunctuality, calculateCycleTime, formatTimeAMPM, formatDuration } from './lib/calculations';
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
import { auth, logout, db } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, getDocs, writeBatch, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { LoginView } from './components/LoginView';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [filterDate, setFilterDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [filterOrderNumber, setFilterOrderNumber] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterMultiLoad, setFilterMultiLoad] = useState('Todos');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOrders = () => {
    // We now use real-time listeners in useEffect
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (isAuthReady && user) {
      const q = query(collection(db, 'orders'), orderBy('orderDate', 'desc'), orderBy('scheduledTime', 'desc'));
      const unsubscribeOrders = onSnapshot(q, (snapshot) => {
        const loadedOrders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Order));
        setOrders(loadedOrders);
      }, (error) => {
        console.error("Firestore error:", error);
        toast.error('Error al sincronizar datos en tiempo real');
      });

      return () => unsubscribeOrders();
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
    // Default sort by date descending, but for the same date, sort by scheduled time ascending
    const timeA = a.scheduledTime || '23:59';
    const timeB = b.scheduledTime || '23:59';
    
    // Sort logic: First by date (descending), then by scheduledTime (ascending)
    if (a.orderDate !== b.orderDate) {
      return b.orderDate.localeCompare(a.orderDate);
    }
    return timeA.localeCompare(timeB);
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
    
    // Pedidos Sheet
    const ordersSheet = workbook.addWorksheet('Pedidos');
    ordersSheet.columns = [
      { header: 'Numero de pedido', key: 'orderNumber', width: 20 },
      { header: 'Fecha', key: 'orderDate', width: 15 },
      { header: 'Elem. a colar', key: 'elementToPour', width: 25 },
      { header: 'Ubicacion', key: 'clientName', width: 25 },
      { header: 'Desc. Tecnica', key: 'technicalDescription', width: 25 },
      { header: 'Prod. Comercial', key: 'commercialProduct', width: 20 },
      { header: 'M.Descarga', key: 'unloadingMethod', width: 20 },
      { header: 'Hora programada', key: 'scheduledTime', width: 15 },
      { header: 'Hora llegada', key: 'firstArrivalTime', width: 15 },
      { header: 'Volumen solicitado', key: 'requestedVolume', width: 15 },
      { header: 'Volumen real', key: 'actualVolume', width: 15 },
      { header: 'Comentarios', key: 'customerComments', width: 30 },
      { header: 'Responsable', key: 'responsible', width: 20 }
    ];
    
    ordersSheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F497D' }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
    });
    
    // Unidades Sheet
    const unitsSheet = workbook.addWorksheet('Unidades');
    unitsSheet.columns = [
      { header: 'Numero de pedido', key: 'orderNumber', width: 20 },
      { header: 'Elemento', key: 'elementToPour', width: 25 },
      { header: 'Ubicacion', key: 'clientName', width: 25 },
      { header: 'Desc.Tecnica', key: 'technicalDescription', width: 25 },
      { header: 'Descarga', key: 'unloadingMethod', width: 20 },
      { header: 'ID unidad', key: 'unitId', width: 15 },
      { header: 'Llegada Obra', key: 'arrivalTime', width: 15 },
      { header: 'Salida Obra', key: 'returnTime', width: 15 },
      { header: 'Tiempo en Obra', key: 'cycleTime', width: 20 },
      { header: 'Status', key: 'statusInfo', width: 20 }
    ];

    unitsSheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F497D' }
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
    });

    const allTripsForExport: { order: Order; trip: typeof filteredOrders[0]['trips'][0] }[] = [];

    filteredOrders.forEach(order => {
      // Find the first arrival time among trips to represent "Hora llegada"
      const firstTripObject = [...order.trips]
        .filter(t => t.arrivalTime)
        .sort((a, b) => a.arrivalTime!.localeCompare(b.arrivalTime!))[0];
      const firstArrivalTime = firstTripObject ? firstTripObject.arrivalTime : '';

      ordersSheet.addRow({
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        elementToPour: order.elementToPour,
        clientName: order.clientName,
        technicalDescription: order.technicalDescription,
        commercialProduct: order.commercialProduct,
        unloadingMethod: order.unloadingMethod,
        scheduledTime: formatTimeAMPM(order.scheduledTime),
        firstArrivalTime: formatTimeAMPM(firstArrivalTime),
        requestedVolume: `${order.requestedVolume} m³`,
        actualVolume: `${order.actualVolume} m³`,
        customerComments: order.customerComments,
        responsible: order.responsible
      });

      order.trips.forEach(trip => {
        allTripsForExport.push({ order, trip });
      });
    });

    allTripsForExport.sort((a, b) => {
      const timeA = a.trip.arrivalTime || '23:59';
      const timeB = b.trip.arrivalTime || '23:59';
      return timeA.localeCompare(timeB);
    });

    allTripsForExport.forEach(({ order, trip }) => {
      const cycleTime = (trip.arrivalTime && trip.returnTime) 
        ? formatDuration(calculateCycleTime(trip.arrivalTime, trip.returnTime)) 
        : '';
        
      unitsSheet.addRow({
        orderNumber: order.orderNumber,
        elementToPour: order.elementToPour,
        clientName: order.clientName,
        technicalDescription: order.technicalDescription,
        unloadingMethod: order.unloadingMethod,
        unitId: trip.unitId,
        arrivalTime: formatTimeAMPM(trip.arrivalTime),
        returnTime: formatTimeAMPM(trip.returnTime),
        cycleTime: cycleTime,
        statusInfo: trip.isNonCompliant ? 'Incumplimiento' : (trip.isMultiLoad ? 'Multicarga' : 'Regular')
      });
    });

    [ordersSheet, unitsSheet].forEach(sheet => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Determine the date string for the filename
    const dateString = filterDate || new Date().toISOString().split('T')[0];
    a.download = `Reporte_${dateString}.xlsx`;
    
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.xls') && !file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('El formato .xls no es compatible. Por favor, guarde el archivo como .xlsx (Excel moderno) e intente de nuevo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      
      let worksheet;
      if (file.name.toLowerCase().endsWith('.csv')) {
        await workbook.csv.read(new Response(arrayBuffer).body as any);
        worksheet = workbook.getWorksheet(1);
      } else {
        await workbook.xlsx.load(arrayBuffer);
        worksheet = workbook.worksheets.find(s => s.state === 'visible') || workbook.worksheets[0];
      }

      if (!worksheet) {
        throw new Error('No se encontró una hoja válida en el archivo');
      }

      const getCellValue = (cell: any): any => {
        if (!cell) return null;
        let val = cell.value;
        if (val && typeof val === 'object' && 'result' in val) val = val.result;
        return val;
      };

      const normalizeDateFunc = (dateVal: any): string => {
        const val = dateVal;
        if (!val) return '';
        
        if (val instanceof Date) {
          // IMPORTANTE: Usar UTC garantiza que el día sea exacto al que se ve en el archivo, 
          // ignorando la zona horaria local del dispositivo.
          const year = val.getUTCFullYear();
          const month = String(val.getUTCMonth() + 1).padStart(2, '0');
          const day = String(val.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        const str = String(val).trim();
        const dateMatch = str.match(/(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/);
        if (dateMatch) {
          let y, m, d;
          if (dateMatch[1].length === 4) {
            y = dateMatch[1]; m = dateMatch[2]; d = dateMatch[3];
          } else {
            d = dateMatch[1]; m = dateMatch[2]; y = dateMatch[3];
          }
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return str;
      };

      const ordersMap = new Map<string, any>();
      
      let headerRowNumber = 1;
      for (let i = 1; i <= 15; i++) {
        const row = worksheet.getRow(i);
        let matchCount = 0;
        row.eachCell((cell) => {
          const v = (cell.text || getCellValue(cell) || '').toString().toLowerCase();
          if (v.includes('fecha') || v.includes('pedido') || v.includes('nro') || v.includes('requer') || v === 'hora') {
            matchCount++;
          }
        });
        // Requerir al menos 2 coincidencias para considerar que es la fila de cabecera
        if (matchCount >= 2) {
          headerRowNumber = i;
          break;
        }
      }

      let colFecha = -1, colHora = -1, colPedido = -1, colVolumen = -1;
      let colCliente = -1, colProdComercial = -1, colDescTecnica = -1, colElemColar = -1;
      let colMetodoDescarga = -1, colFrecuencia = -1, colResponsable = -1, colComentarios = -1;

      worksheet.getRow(headerRowNumber).eachCell((cell, colNumber) => {
        const val = (cell.text || getCellValue(cell) || '').toString().toLowerCase().trim();
        
        if (val.includes('fecha')) colFecha = colNumber;
        else if (val === 'hora' || val === 'hora requer' || val === 'hora requer.' || val === 'h.' || val === 'hr' || val.includes('hora requer')) {
          colHora = colNumber;
        }
        else if (val.includes('requer') || val.includes('prog') || (val.includes('hora') && !val.includes('llegada'))) {
          // Si no es un match exacto, preferir columnas que tengan "hora" pero que NO sean de llegada si es posible
          if (colHora === -1) colHora = colNumber;
        }
        else if (val.includes('vol') || val.includes('m3') || val.includes('cantidad')) colVolumen = colNumber;
        else if (val.includes('pedido') || val.includes('nro') || val.includes('orden')) colPedido = colNumber;
        else if (val.includes('cliente')) colCliente = colNumber;
        else if (val.includes('prod. comercial') || val.includes('producto')) colProdComercial = colNumber;
        else if (val.includes('técnica') || val.includes('especificacion')) colDescTecnica = colNumber;
        else if (val.includes('colar') || val.includes('elemento')) colElemColar = colNumber;
        else if (val.includes('descarga') || val.includes('metodo')) colMetodoDescarga = colNumber;
        else if (val.includes('frecuencia') || val.includes('frec.')) colFrecuencia = colNumber;
        else if (val.includes('responsable')) colResponsable = colNumber;
        else if (val.includes('comentario') || val.includes('obs') || val.includes('observación')) colComentarios = colNumber;
      });

      if (colFecha === -1) colFecha = 1;
      if (colHora === -1) colHora = 2;
      if (colPedido === -1) colPedido = 3;
      if (colVolumen === -1) colVolumen = 4;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNumber) return;
        
        const orderDate = normalizeDateFunc(getCellValue(row.getCell(colFecha)));
        let orderNumber = getCellValue(row.getCell(colPedido))?.toString().trim() || '';
        if (!orderDate || !orderNumber) return;

        let scheduledTime = '';
        const cell = row.getCell(colHora);
        const rawText = cell.text ? String(cell.text).trim() : '';
        let val = getCellValue(cell);

        // 1. Prioridad absoluta al texto visible (Regla: Lo que ves en Excel es lo que obtienes)
        const timeMatch = rawText.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          let h = parseInt(timeMatch[1]);
          const m = timeMatch[2];
          // Normalizar texto para detectar am/pm incluso si tiene puntos (p. m. -> pm)
          const normalizedIndicator = rawText.toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
          if (normalizedIndicator.includes('pm') && h < 12) h += 12;
          if (normalizedIndicator.includes('am') && h === 12) h = 0;
          scheduledTime = `${h.toString().padStart(2, '0')}:${m}`;
        } 
        
        // 2. Fallback al valor numérico o Date usando lógica de zona horaria CERO (UTC)
        if (!scheduledTime) {
          if (typeof val === 'number') {
            // Conversión matemática pura sin involucrar objetos Date (evita saltos de zona horaria)
            const totalSecs = Math.round(val * 24 * 3600);
            const h = Math.floor(totalSecs / 3600) % 24;
            const m = Math.floor((totalSecs % 3600) / 60) % 60;
            scheduledTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          } else if (val instanceof Date) {
            // Siempre usar UTC para horas de Excel ya que representan el tiempo "crudo" sin offset
            const h = val.getUTCHours().toString().padStart(2, '0');
            const m = val.getUTCMinutes().toString().padStart(2, '0');
            scheduledTime = `${h}:${m}`;
          }
        }

        if (!scheduledTime) return; 

        const requestedVolume = parseFloat(getCellValue(row.getCell(colVolumen))?.toString() || '0');
        const compositeKey = `${orderNumber}_${orderDate}_${scheduledTime}`.replace(/\s+/g, '_');

        if (!ordersMap.has(compositeKey)) {
          ordersMap.set(compositeKey, {
            // Usamos un ID determinístico para evitar duplicados si se re-importa el mismo archivo
            id: `order_${compositeKey}`,
            orderNumber,
            orderDate,
            scheduledTime,
            requestedVolume,
            actualVolume: 0,
            unitCapacity: 8,
            status: 'A tiempo',
            trips: [],
            clientName: colCliente !== -1 ? getCellValue(row.getCell(colCliente))?.toString() || '' : '',
            commercialProduct: colProdComercial !== -1 ? getCellValue(row.getCell(colProdComercial))?.toString() || '' : '',
            technicalDescription: colDescTecnica !== -1 ? getCellValue(row.getCell(colDescTecnica))?.toString() || '' : '',
            elementToPour: colElemColar !== -1 ? getCellValue(row.getCell(colElemColar))?.toString() || '' : '',
            unloadingMethod: colMetodoDescarga !== -1 ? getCellValue(row.getCell(colMetodoDescarga))?.toString() || '' : '',
            frequency: colFrecuencia !== -1 ? getCellValue(row.getCell(colFrecuencia))?.toString() || '' : '',
            customerComments: colComentarios !== -1 ? getCellValue(row.getCell(colComentarios))?.toString() || '' : '',
            responsible: colResponsable !== -1 ? getCellValue(row.getCell(colResponsable))?.toString() || '' : '',
          });
        }
      });

      const batch = writeBatch(db);
      for (const order of ordersMap.values()) {
        const orderRef = doc(db, 'orders', order.id);
        batch.set(orderRef, { ...order, createdAt: serverTimestamp() });
      }
      await batch.commit();
      toast.success(`Importados ${ordersMap.size} pedidos correctamente`);
    } catch (error: any) {
      console.error("Import error details:", error);
      toast.error('Error al procesar el archivo Excel en el navegador');
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
