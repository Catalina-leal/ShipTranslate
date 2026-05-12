import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function parseEdiFile(file) {
  const formData = new FormData();
  formData.append('ediFile', file);

  const response = await api.post('/shipments/parse', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function fetchShipments() {
  const response = await api.get('/shipments');
  return response.data;
}

export async function fetchShipment(id) {
  const response = await api.get(`/shipments/${id}`);
  return response.data;
}

export async function saveShipment(shipment) {
  const response = await api.post('/shipments', shipment);
  return response.data;
}

export async function uploadEdiFile(file) {
  const formData = new FormData();
  formData.append('ediFile', file);

  const response = await api.post('/shipments/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
