import axios from 'axios';

// Capa unica de comunicacion con el backend.
// Todas las paginas llaman estas funciones en vez de usar axios directamente.

const defaultApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const fallbackPorts = [4000, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009];
const baseUrls = [...new Set([
  defaultApiBase,
  ...fallbackPorts.map((port) => `http://localhost:${port}/api`),
])];

const api = axios.create({
  baseURL: baseUrls[0],
  headers: {
    'Content-Type': 'application/json',
  },
});

async function requestWithFallback(config) {
  // Si el backend se levanta en otro puerto, intenta puertos alternativos.
  let lastError = null;

  for (const baseUrl of baseUrls) {
    try {
      const instance = axios.create({
        baseURL: baseUrl,
        headers: config.headers || {
          'Content-Type': 'application/json',
        },
      });
      return await instance.request(config);
    } catch (err) {
      lastError = err;
      if (err.response) {
        throw err;
      }
    }
  }

  throw lastError;
}

export async function parsePdfFile(formData) {
  // Envia un PDF al backend para extraer datos con pdfjs/IA.
  const response = await requestWithFallback({
    method: 'post',
    url: '/shipments/parse-pdf',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function updateTracking(id, extractedData) {
  // Guarda ajustes manuales sobre la informacion extraida desde un PDF.
  const response = await requestWithFallback({
    method: 'put',
    url: `/shipments/trackings/${id}`,
    data: { extractedData },
  });
  return response.data;
}

export async function parseEdiFile(file) {
  // Envia un archivo EDI solo para parsearlo y mostrar vista previa.
  const formData = new FormData();
  formData.append('ediFile', file);

  const response = await requestWithFallback({
    method: 'post',
    url: '/shipments/parse',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function loginUser(credentials) {
  // Valida correo/contrasena y recibe usuario + rol.
  const response = await requestWithFallback({
    method: 'post',
    url: '/auth/login',
    data: credentials,
  });
  return response.data;
}

export async function createAccessRequest(payload) {
  // Envia solicitudes de crear cuenta o recuperar acceso.
  const response = await requestWithFallback({
    method: 'post',
    url: '/auth/access-requests',
    data: payload,
  });
  return response.data;
}

export async function fetchAccessRequests() {
  // Obtiene solicitudes administrativas para el panel admin.
  const response = await requestWithFallback({
    method: 'get',
    url: '/auth/access-requests',
  });
  return response.data;
}

export async function updateAccessRequest(id, updates) {
  // Actualiza el estado de una solicitud administrativa.
  const response = await requestWithFallback({
    method: 'put',
    url: `/auth/access-requests/${id}`,
    data: updates,
  });
  return response.data;
}

export async function fetchShipments() {
  // Obtiene el historico de EDIs guardados.
  const response = await requestWithFallback({
    method: 'get',
    url: '/shipments',
  });
  return response.data;
}

export async function fetchShipment(id) {
  // Obtiene el detalle de un EDI guardado.
  const response = await requestWithFallback({
    method: 'get',
    url: `/shipments/${id}`,
  });
  return response.data;
}

export async function saveShipment(shipment) {
  // Guarda un shipment desde JSON estructurado.
  const response = await requestWithFallback({
    method: 'post',
    url: '/shipments',
    data: shipment,
  });
  return response.data;
}

export async function updateShipment(id, updates) {
  // Guarda cambios hechos sobre un EDI ya registrado.
  const response = await requestWithFallback({
    method: 'put',
    url: `/shipments/${id}`,
    data: updates,
  });
  return response.data;
}

export async function deleteShipment(id) {
  // Elimina un EDI del historico.
  const response = await requestWithFallback({
    method: 'delete',
    url: `/shipments/${id}`,
  });
  return response.data;
}

function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem('shiptranslateSession')) || null;
  } catch {
    return null;
  }
}

export async function uploadEdiFile(file, editedData = null, isEdited = false) {
  // Sube el archivo EDI y opcionalmente los datos editados.
  // Tambien adjunta el usuario de sesion para trazabilidad administrativa.
  const formData = new FormData();
  formData.append('ediFile', file);
  formData.append('isEdited', isEdited.toString());

  const sessionUser = getSessionUser();

  if (sessionUser) {
    formData.append(
      'processedBy',
      JSON.stringify({
        id: sessionUser.id,
        name: sessionUser.name,
        email: sessionUser.email,
        role: sessionUser.role,
      })
    );
  }

  if (editedData !== null) {
    formData.append('editedData', JSON.stringify(editedData));
  }

  const response = await requestWithFallback({
    method: 'post',
    url: '/shipments/upload',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
