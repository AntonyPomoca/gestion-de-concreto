import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || 'concrete.db';
const db = new Database(dbPath);

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    orderNumber TEXT NOT NULL,
    orderDate TEXT NOT NULL,
    scheduledTime TEXT NOT NULL,
    requestedVolume REAL NOT NULL DEFAULT 0,
    actualVolume REAL NOT NULL DEFAULT 0,
    unitCapacity REAL NOT NULL,
    status TEXT,
    clientName TEXT,
    commercialProduct TEXT,
    technicalDescription TEXT,
    elementToPour TEXT,
    unloadingMethod TEXT,
    frequency TEXT,
    customerComments TEXT,
    responsible TEXT
  );

  CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    orderId TEXT NOT NULL,
    unitId TEXT NOT NULL,
    arrivalTime TEXT,
    returnTime TEXT,
    isMultiLoad INTEGER DEFAULT 0,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

// Migration: Add requestedVolume and actualVolume if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(orders)").all() as any[];
const columnNames = tableInfo.map(c => c.name);

if (columnNames.includes('totalVolume')) {
  console.log("Migrating database schema: totalVolume -> requestedVolume, actualVolume");
  db.transaction(() => {
    // 1. Ensure new columns exist in old table temporarily to copy data if needed
    if (!columnNames.includes('requestedVolume')) {
      db.exec("ALTER TABLE orders ADD COLUMN requestedVolume REAL NOT NULL DEFAULT 0");
    }
    if (!columnNames.includes('actualVolume')) {
      db.exec("ALTER TABLE orders ADD COLUMN actualVolume REAL NOT NULL DEFAULT 0");
    }
    
    // 2. Copy data from totalVolume
    db.exec("UPDATE orders SET requestedVolume = totalVolume, actualVolume = totalVolume");

    // 3. Recreate table without totalVolume
    db.exec("PRAGMA foreign_keys=OFF");
    db.exec(`CREATE TABLE orders_new (
      id TEXT PRIMARY KEY,
      orderNumber TEXT NOT NULL,
      orderDate TEXT NOT NULL,
      scheduledTime TEXT NOT NULL,
      requestedVolume REAL NOT NULL DEFAULT 0,
      actualVolume REAL NOT NULL DEFAULT 0,
      unitCapacity REAL NOT NULL
    )`);
    
    db.exec(`INSERT INTO orders_new (id, orderNumber, orderDate, scheduledTime, requestedVolume, actualVolume, unitCapacity)
             SELECT id, orderNumber, orderDate, scheduledTime, requestedVolume, actualVolume, unitCapacity FROM orders`);
    
    db.exec("DROP TABLE orders");
    db.exec("ALTER TABLE orders_new RENAME TO orders");
    db.exec("PRAGMA foreign_keys=ON");
  })();
} else {
  // Just ensure columns exist if for some reason they are missing but totalVolume is also gone
  if (!columnNames.includes('requestedVolume')) {
    db.exec("ALTER TABLE orders ADD COLUMN requestedVolume REAL NOT NULL DEFAULT 0");
  }
  if (!columnNames.includes('actualVolume')) {
    db.exec("ALTER TABLE orders ADD COLUMN actualVolume REAL NOT NULL DEFAULT 0");
  }
  if (!columnNames.includes('status')) {
    db.exec("ALTER TABLE orders ADD COLUMN status TEXT");
  }
  if (!columnNames.includes('clientName')) {
    db.exec("ALTER TABLE orders ADD COLUMN clientName TEXT");
  }
  if (!columnNames.includes('projectName')) {
    db.exec("ALTER TABLE orders ADD COLUMN projectName TEXT");
  }
  if (!columnNames.includes('concreteMix')) {
    db.exec("ALTER TABLE orders ADD COLUMN concreteMix TEXT");
  }
  if (!columnNames.includes('slump')) {
    db.exec("ALTER TABLE orders ADD COLUMN slump TEXT");
  }
  if (!columnNames.includes('commercialProduct')) {
    db.exec("ALTER TABLE orders ADD COLUMN commercialProduct TEXT");
  }
  if (!columnNames.includes('technicalDescription')) {
    db.exec("ALTER TABLE orders ADD COLUMN technicalDescription TEXT");
  }
  if (!columnNames.includes('elementToPour')) {
    db.exec("ALTER TABLE orders ADD COLUMN elementToPour TEXT");
  }
  if (!columnNames.includes('unloadingMethod')) {
    db.exec("ALTER TABLE orders ADD COLUMN unloadingMethod TEXT");
  }
  if (!columnNames.includes('frequency')) {
    db.exec("ALTER TABLE orders ADD COLUMN frequency TEXT");
  }
  if (!columnNames.includes('customerComments')) {
    db.exec("ALTER TABLE orders ADD COLUMN customerComments TEXT");
  }
  if (!columnNames.includes('responsible')) {
    db.exec("ALTER TABLE orders ADD COLUMN responsible TEXT");
  }

  // Migration for trips table
  const tripsTableInfo = db.prepare("PRAGMA table_info(trips)").all() as any[];
  const tripsColumnNames = tripsTableInfo.map(c => c.name);
  if (!tripsColumnNames.includes('isMultiLoad')) {
    db.exec("ALTER TABLE trips ADD COLUMN isMultiLoad INTEGER DEFAULT 0");
  }
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

function normalizeDate(dateVal: any): string {
  if (!dateVal) return '';
  
  // Handle ExcelJS cell objects (formulas, etc)
  let val = dateVal;
  if (typeof dateVal === 'object' && dateVal.result !== undefined) {
    val = dateVal.result;
  }

  if (val instanceof Date) {
    // Use local date parts to avoid timezone shifts
    const year = val.getFullYear();
    const month = (val.getMonth() + 1).toString().padStart(2, '0');
    const day = val.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const str = val.toString().trim();
  if (!str) return '';

  // Handle Excel serial date (number)
  if (!isNaN(Number(str)) && Number(str) > 30000 && Number(str) < 60000) {
    const excelDate = new Date((Number(str) - 25569) * 86400 * 1000);
    const year = excelDate.getUTCFullYear();
    const month = (excelDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = excelDate.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  // Try to parse DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const [_, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const day = parsed.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return str;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  
  // Request logging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      env: process.env.NODE_ENV,
      dbPath: dbPath
    });
  });

  app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working' });
  });

  app.get('/api/orders', (req, res) => {
    const orders = db.prepare('SELECT * FROM orders ORDER BY orderDate DESC, scheduledTime DESC').all();
    const trips = db.prepare('SELECT * FROM trips').all();
    
    const ordersWithTrips = orders.map((order: any) => ({
      ...order,
      trips: trips.filter((t: any) => t.orderId === order.id).map((t: any) => ({
        ...t,
        isMultiLoad: !!t.isMultiLoad
      }))
    }));
    
    res.json(ordersWithTrips);
  });

  app.post('/api/orders', (req, res) => {
    const { 
      id, orderNumber, orderDate, scheduledTime, requestedVolume, actualVolume, unitCapacity, trips, status, 
      clientName,
      commercialProduct, technicalDescription, elementToPour, unloadingMethod, frequency, customerComments, responsible
    } = req.body;
    const normalizedDate = normalizeDate(orderDate);
    
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id, orderNumber, orderDate, scheduledTime, requestedVolume, actualVolume, unitCapacity, status, 
        clientName,
        commercialProduct, technicalDescription, elementToPour, unloadingMethod, frequency, customerComments, responsible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTrip = db.prepare('INSERT INTO trips (id, orderId, unitId, arrivalTime, returnTime, isMultiLoad) VALUES (?, ?, ?, ?, ?, ?)');
    
    const transaction = db.transaction(() => {
      insertOrder.run(
        id, orderNumber, normalizedDate, scheduledTime, requestedVolume, actualVolume, unitCapacity, status, 
        clientName,
        commercialProduct, technicalDescription, elementToPour, unloadingMethod, frequency, customerComments, responsible
      );
      for (const trip of trips) {
        insertTrip.run(trip.id, id, trip.unitId, trip.arrivalTime, trip.returnTime, trip.isMultiLoad ? 1 : 0);
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save order' });
    }
  });

  app.delete('/api/orders', (req, res) => {
    const { date } = req.query;
    try {
      if (date) {
        const normalizedDate = normalizeDate(date);
        // Delete orders for a specific date
        // We use LIKE or a more flexible check if normalization isn't perfect, 
        // but since we normalize on import now, exact match on normalized should work.
        // To be safe for existing data, we can try to match both.
        const ordersToDelete = db.prepare('SELECT id FROM orders WHERE orderDate = ? OR orderDate LIKE ?').all(normalizedDate, `%${normalizedDate}%`) as { id: string }[];
        const ids = ordersToDelete.map(o => o.id);
        
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          db.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).run(...ids);
        }
      } else {
        db.prepare('DELETE FROM orders').run();
        db.prepare('DELETE FROM trips').run();
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete orders' });
    }
  });

  app.post('/api/import-excel', upload.single('file'), async (req, res) => {
    console.log(`${new Date().toISOString()} - Import request received:`, req.file?.originalname, "Size:", req.file?.size);
    
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      console.error("No file received or file is empty");
      return res.status(400).json({ error: 'El archivo está vacío o no se recibió correctamente.' });
    }

    const fileName = req.file.originalname.toLowerCase();
    if (fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      return res.status(400).json({ error: 'El formato .xls no es compatible. Por favor, guarde el archivo como .xlsx (Excel moderno) e intente de nuevo.' });
    }

    try {
      const workbook = new ExcelJS.Workbook();
      
      // Check file extension or mimetype to determine how to load
      const isCsv = fileName.endsWith('.csv') || req.file.mimetype === 'text/csv';
      
      let worksheet;
      try {
        if (isCsv) {
          console.log("Loading CSV...");
          const stream = Readable.from(req.file.buffer);
          await workbook.csv.read(stream);
          worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
        } else {
          console.log("Loading XLSX...");
          await workbook.xlsx.load(req.file.buffer);
          // Try to find the first visible sheet or just any sheet
          worksheet = workbook.worksheets.find(s => s.state === 'visible') || workbook.worksheets[0] || workbook.getWorksheet(1);
        }
      } catch (loadError: any) {
        console.error("ExcelJS load error:", loadError);
        return res.status(400).json({ error: 'No se pudo leer el archivo. Asegúrese de que sea un archivo Excel (.xlsx) o CSV válido. Error: ' + loadError.message });
      }
      
      if (!worksheet) {
        console.error("No worksheet found in file. Available sheets:", workbook.worksheets.length, "Names:", workbook.worksheets.map(s => s.name));
        return res.status(400).json({ error: 'El archivo no contiene una hoja de cálculo válida o está vacío. Intente guardarlo de nuevo en Excel como .xlsx.' });
      }

      // Check if worksheet actually has data
      if (worksheet.rowCount <= 1 && worksheet.actualRowCount <= 0) {
        console.error("Worksheet appears to be empty");
        return res.status(400).json({ error: 'La hoja de cálculo parece estar vacía.' });
      }

      console.log("Worksheet loaded successfully. Name:", worksheet.name, "Rows:", worksheet.rowCount, "Actual Rows:", worksheet.actualRowCount);

      const ordersMap = new Map();
      const trips: any[] = [];

      let colFecha = 1;
      let colHora = 2;
      let colPedido = 3;
      let colVolumen = 4;
      let colCliente = -1;
      let colProdComercial = -1;
      let colDescTecnica = -1;
      let colElemColar = -1;
      let colMetodoDescarga = -1;
      let colFrecuencia = -1;
      let colComentarios = -1;
      let colResponsable = -1;

      // Scan first 10 rows to find the header row and map columns
      for (let i = 1; i <= 10; i++) {
        const row = worksheet.getRow(i);
        let foundInRow = 0;
        row.eachCell((cell, colNumber) => {
          const val = cell.value?.toString().toLowerCase() || '';
          if (val.includes('fecha') || val.includes('date')) { colFecha = colNumber; foundInRow++; }
          else if (val.includes('hora') || val.includes('time') || val.includes('prog')) { colHora = colNumber; foundInRow++; }
          else if (val.includes('vol') || val.includes('m3') || val.includes('cantidad')) { colVolumen = colNumber; foundInRow++; }
          else if (val.includes('pedido') || val.includes('order') || val.includes('nro') || val.includes('num')) { colPedido = colNumber; foundInRow++; }
          else if (val.includes('cliente') || val.includes('client') || val.includes('ubicacion') || val.includes('ubicación')) { colCliente = colNumber; }
          else if (val.includes('prod. comercial') || val.includes('comercial')) { colProdComercial = colNumber; }
          else if (val.includes('desc. técnica') || val.includes('técnica')) { colDescTecnica = colNumber; }
          else if (val.includes('elem. a colar') || val.includes('colar')) { colElemColar = colNumber; }
          else if (val.includes('m. descarga') || val.includes('descarga')) { colMetodoDescarga = colNumber; }
          else if (val.includes('frec.')) { colFrecuencia = colNumber; }
          else if (val.includes('comentarios')) { colComentarios = colNumber; }
          else if (val.includes('responsable')) { colResponsable = colNumber; }
        });
        // If we found at least 2 headers, we assume this is the header row or a row near it
        if (foundInRow >= 2) break;
      }

      worksheet.eachRow((row, rowNumber) => {
        // Skip rows that look like headers or are empty
        const cell1 = row.getCell(colFecha).value?.toString().toLowerCase() || '';
        const cell2 = row.getCell(colPedido).value?.toString().toLowerCase() || '';
        if (cell1.includes('fecha') || cell2.includes('pedido') || cell2.includes('nro')) return;

        const orderDate = normalizeDate(row.getCell(colFecha).value);
        if (!orderDate || orderDate === 'null' || orderDate === '') return;

        let scheduledTime = '';
        const timeCell = row.getCell(colHora).value;
        if (timeCell instanceof Date) {
          scheduledTime = `${timeCell.getUTCHours().toString().padStart(2, '0')}:${timeCell.getUTCMinutes().toString().padStart(2, '0')}`;
        } else if (typeof timeCell === 'number') {
           const totalMinutes = Math.round(timeCell * 24 * 60);
           const hours = Math.floor(totalMinutes / 60);
           const minutes = totalMinutes % 60;
           scheduledTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } else if (timeCell && typeof timeCell === 'object' && 'result' in timeCell) {
          scheduledTime = timeCell.result?.toString() || '';
        } else if (timeCell) {
          scheduledTime = timeCell.toString();
        }

        // Improved Order Number extraction to handle formulas, numbers, and strings
        const orderNumberCell = row.getCell(colPedido);
        let orderNumber = '';
        if (orderNumberCell.value !== null && orderNumberCell.value !== undefined) {
          if (typeof orderNumberCell.value === 'object') {
            if ('result' in orderNumberCell.value) {
              orderNumber = orderNumberCell.value.result?.toString() || '';
            } else if ('text' in orderNumberCell.value) {
              orderNumber = orderNumberCell.value.text?.toString() || '';
            } else {
              orderNumber = orderNumberCell.value.toString();
            }
          } else {
            orderNumber = orderNumberCell.value.toString();
          }
        }
        orderNumber = orderNumber.trim();

        // Improved Volume extraction
        const volumeCell = row.getCell(colVolumen);
        let requestedVolume = 0;
        if (volumeCell.value !== null && volumeCell.value !== undefined) {
          if (typeof volumeCell.value === 'object' && 'result' in volumeCell.value) {
            requestedVolume = parseFloat(volumeCell.value.result?.toString() || '0');
          } else {
            requestedVolume = parseFloat(volumeCell.value.toString() || '0');
          }
        }
        const actualVolume = 0; // Always start at 0 for manual filling as requested
        const unitCapacity = 8; // Default capacity
        
        const clientName = colCliente !== -1 ? row.getCell(colCliente).value?.toString() || '' : '';
        const commercialProduct = colProdComercial !== -1 ? row.getCell(colProdComercial).value?.toString() || '' : '';
        const technicalDescription = colDescTecnica !== -1 ? row.getCell(colDescTecnica).value?.toString() || '' : '';
        const elementToPour = colElemColar !== -1 ? row.getCell(colElemColar).value?.toString() || '' : '';
        const unloadingMethod = colMetodoDescarga !== -1 ? row.getCell(colMetodoDescarga).value?.toString() || '' : '';
        const frequency = colFrecuencia !== -1 ? row.getCell(colFrecuencia).value?.toString() || '' : '';
        const customerComments = colComentarios !== -1 ? row.getCell(colComentarios).value?.toString() || '' : '';
        const responsible = colResponsable !== -1 ? row.getCell(colResponsable).value?.toString() || '' : '';

        if (!orderNumber || orderNumber === '') return;
        const compositeKey = `${orderNumber}_${orderDate}`;

        let orderId = ordersMap.get(compositeKey)?.id;
        if (!orderId) {
          const existingOrder = db.prepare('SELECT id FROM orders WHERE orderNumber = ? AND orderDate = ?').get(orderNumber, orderDate) as { id: string } | undefined;
          
          if (existingOrder) {
            orderId = existingOrder.id;
          } else {
            orderId = Math.random().toString(36).substring(2, 15);
          }

          ordersMap.set(compositeKey, {
            id: orderId,
            orderNumber,
            orderDate,
            scheduledTime,
            requestedVolume,
            actualVolume,
            unitCapacity,
            clientName,
            commercialProduct,
            technicalDescription,
            elementToPour,
            unloadingMethod,
            frequency,
            customerComments,
            responsible
          });
        }
      });

      const insertOrder = db.prepare(`
        INSERT OR REPLACE INTO orders (
          id, orderNumber, orderDate, scheduledTime, requestedVolume, actualVolume, unitCapacity, status, 
          clientName,
          commercialProduct, technicalDescription, elementToPour, unloadingMethod, frequency, customerComments, responsible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertTrip = db.prepare('INSERT INTO trips (id, orderId, unitId, arrivalTime, returnTime, isMultiLoad) VALUES (?, ?, ?, ?, ?, ?)');
      
      const transaction = db.transaction(() => {
        for (const order of ordersMap.values()) {
          insertOrder.run(
            order.id, order.orderNumber, order.orderDate, order.scheduledTime, order.requestedVolume, order.actualVolume, order.unitCapacity, order.status || null, 
            order.clientName,
            order.commercialProduct, order.technicalDescription, order.elementToPour, order.unloadingMethod, order.frequency, order.customerComments, order.responsible
          );
        }
        for (const trip of trips) {
          insertTrip.run(trip.id, trip.orderId, trip.unitId, trip.arrivalTime, trip.returnTime, trip.isMultiLoad ? 1 : 0);
        }
      });

      transaction();
      res.json({ success: true, message: `Imported ${ordersMap.size} orders and ${trips.length} trips` });
    } catch (error: any) {
      console.error("Import error:", error);
      res.status(500).json({ error: 'Failed to import data: ' + error.message });
    }
  });

  app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const { 
      orderNumber, orderDate, scheduledTime, requestedVolume, actualVolume, unitCapacity, trips, status, 
      clientName,
      commercialProduct, technicalDescription, elementToPour, unloadingMethod, frequency, customerComments, responsible
    } = req.body;
    
    const updateOrder = db.prepare(`
      UPDATE orders SET 
        orderNumber = ?, orderDate = ?, scheduledTime = ?, requestedVolume = ?, actualVolume = ?, unitCapacity = ?, status = ?, 
        clientName = ?,
        commercialProduct = ?, technicalDescription = ?, elementToPour = ?, unloadingMethod = ?, frequency = ?, customerComments = ?, responsible = ?
      WHERE id = ?
    `);
    const deleteTrips = db.prepare('DELETE FROM trips WHERE orderId = ?');
    const insertTrip = db.prepare('INSERT INTO trips (id, orderId, unitId, arrivalTime, returnTime, isMultiLoad) VALUES (?, ?, ?, ?, ?, ?)');
    
    const transaction = db.transaction(() => {
      updateOrder.run(
        orderNumber, orderDate, scheduledTime, requestedVolume, actualVolume, unitCapacity, status, 
        clientName,
        commercialProduct, technicalDescription, elementToPour, unloadingMethod, frequency, customerComments, responsible,
        id
      );
      deleteTrips.run(id);
      for (const trip of trips) {
        insertTrip.run(trip.id, id, trip.unitId, trip.arrivalTime, trip.returnTime, trip.isMultiLoad ? 1 : 0);
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update order' });
    }
  });

  app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const deleteOrder = db.prepare('DELETE FROM orders WHERE id = ?');
    const deleteTrips = db.prepare('DELETE FROM trips WHERE orderId = ?');
    
    const transaction = db.transaction(() => {
      deleteTrips.run(id);
      deleteOrder.run(id);
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // API 404 handler
  app.all('/api/*', (req, res) => {
    console.warn(`${new Date().toISOString()} - API Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: `Route ${req.method} ${req.url} not found`,
      method: req.method,
      url: req.url
    });
  });

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`Starting server in ${isProduction ? 'production' : 'development'} mode`);

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  });
}

startServer();
