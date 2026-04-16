import { Order } from '../types';

export const api = {
  async getOrders(): Promise<Order[]> {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },

  async createOrder(order: Order): Promise<void> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error('Failed to create order');
  },

  async updateOrder(order: Order): Promise<void> {
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (!res.ok) throw new Error('Failed to update order');
  },

  async deleteOrder(id: string): Promise<void> {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete order');
  },

  async deleteAllOrders(date?: string): Promise<void> {
    const url = date ? `/api/orders?date=${date}` : '/api/orders';
    const res = await fetch(url, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete orders');
  },

  async importExcel(file: File): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/import-excel', {
      method: 'POST',
      body: formData,
    });
    
    const text = await res.text();
    const contentType = res.headers.get('content-type');
    const isHtml = contentType?.includes('text/html') || text.trim().startsWith('<!doctype html') || text.trim().startsWith('<html');

    if (!res.ok) {
      if (isHtml) {
        throw new Error(`Error del servidor (${res.status}): El servidor devolvió una página HTML en lugar de JSON. Esto puede indicar que la ruta no existe o hay un error de configuración.`);
      }
      
      let errorData;
      try {
        errorData = JSON.parse(text);
      } catch (e) {
        throw new Error(`Error del servidor (${res.status}): La respuesta no es un JSON válido. Respuesta: ${text.substring(0, 100)}...`);
      }
      throw new Error(errorData.error || 'Failed to import data');
    }
    
    try {
      return JSON.parse(text);
    } catch (e) {
      if (isHtml) {
        throw new Error(`Error al procesar respuesta exitosa: El servidor devolvió una página HTML (posiblemente index.html) en lugar del JSON esperado. Verifique que la ruta de la API sea correcta.`);
      }
      throw new Error(`Error al procesar respuesta exitosa: El servidor no devolvió un JSON válido. Respuesta: ${text.substring(0, 100)}...`);
    }
  }
};
