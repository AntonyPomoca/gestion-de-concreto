# Sistema de Gestión de Órdenes de Concreto

Este es un sistema completo para la gestión y análisis de órdenes de pedido de concreto premezclado, con enfoque en el control de tiempos de entrega, cálculo de multicargas y análisis del retorno de unidades.

## Requisitos Previos

- Node.js (v18 o superior)
- npm (v9 o superior)

## Instalación

1. Clona o descarga el repositorio.
2. Instala las dependencias:
   \`\`\`bash
   npm install
   \`\`\`

## Ejecución en Desarrollo

Para ejecutar el sistema en modo desarrollo:

\`\`\`bash
npm run dev
\`\`\`

El servidor se iniciará en \`http://localhost:3000\`.

## Construcción para Producción

Para compilar el proyecto para producción:

\`\`\`bash
npm run build
\`\`\`

Para ejecutar la versión compilada:

\`\`\`bash
npm start
\`\`\`

## Uso del Sistema

1. **Dashboard**: Al inicio verás un resumen de los pedidos, unidades utilizadas, puntualidad y tiempos promedio.
2. **Nuevo Pedido**: Haz clic en "Nuevo Pedido" para registrar una orden. El sistema calculará automáticamente la cantidad de viajes (unidades) necesarios si el volumen total supera la capacidad de una unidad.
3. **Filtros**: Utiliza los campos de búsqueda por número, fecha y estado para filtrar la lista de pedidos.
4. **Importar/Exportar**: 
   - Puedes exportar todos los datos a un archivo Excel (.xlsx) con hojas separadas para Resumen, Pedidos y Unidades.
   - Puedes importar datos desde un archivo Excel. Se incluye un archivo de ejemplo \`ejemplo_pedidos.csv\` que puedes abrir en Excel y guardar como \`.xlsx\` para probar la importación.

## Estructura de la Base de Datos (SQLite)

La base de datos \`concrete.db\` se creará automáticamente en la raíz del proyecto al iniciar el servidor. Contiene dos tablas:
- \`orders\`: Almacena la información general del pedido.
- \`trips\`: Almacena la información de cada viaje (unidad) asociado a un pedido.
