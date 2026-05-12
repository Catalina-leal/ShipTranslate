import {
  addShipment,
  findShipment,
  getAllShipments,
  removeShipment,
  updateShipmentData,
} from '../models/shipmentModel.js';

function parseEdiField(text, segment, qualifierPattern) {
  const regex = new RegExp(`${segment}\\+(?:${qualifierPattern})\\+([^'\\r\\n]*)`, 'i');
  const match = text.match(regex);
  if (!match) return null;

  const field = match[1] || '';
  const parts = field.split(/[:+]/).filter(Boolean);
  const value = parts.length ? parts[parts.length - 1] : field;
  return value.replace(/\+/g, ' ').trim();
}

export function parseEdiContent(content, fileName) {
  const normalizedContent = content.replace(/\r/g, '');
  const segments = normalizedContent.split("'").filter(s => s.trim() && s.length > 0).map(s => s.trim());

  // Dividir en mensajes individuales basados en UNH y UNT
  const messages = [];
  let currentMessage = null;

  segments.forEach(segment => {
    const parts = segment.split('+');
    const segmentType = parts[0];

    if (segmentType === 'UNH') {
      // Iniciar nuevo mensaje
      currentMessage = {
        messageId: parts[1] || '',
        messageType: parts[2]?.split(':')[0] || '',
        documentNumber: 'Sin número',
        referenceNumber: 'Sin referencia',
        origin: 'Origen desconocido',
        destination: 'Destino desconocido',
        client: `EDI ${fileName}`,
        weight: 0,
        status: 'Registrado desde EDI',
        dates: {},
        containers: [],
        transport: {},
        goods: {},
        currency: 'USD',
        amounts: [],
        tempTdtSegments: [], // Array temporal para almacenar todos los TDT
      };
    } else if (segmentType === 'UNT') {
      // Procesar el TDT mayor antes de finalizar el mensaje
      if (currentMessage && currentMessage.tempTdtSegments.length > 0) {
        // Encontrar el TDT con el número más alto en parts[1]
        let maxTdtNumber = -1;
        let selectedTdt = null;

        currentMessage.tempTdtSegments.forEach(tdtSegment => {
          const tdtNumber = parseInt(tdtSegment[1]) || 0;
          if (tdtNumber > maxTdtNumber) {
            maxTdtNumber = tdtNumber;
            selectedTdt = tdtSegment;
          }
        });

        // Procesar el TDT seleccionado
        if (selectedTdt) {
          const tdtParts = selectedTdt; // Ya son las partes divididas
          if (tdtParts[2]) {
            currentMessage.transport.voyage = tdtParts[2];
          }
          if (tdtParts[8]) {
            // Extraer información del buque: 9293765:::KOTA SANTOS
            const vesselInfo = tdtParts[8];
            if (vesselInfo.includes(':::')) {
              const [loydCode, vesselName] = vesselInfo.split(':::');
              currentMessage.transport.loyd = loydCode.replace(/\+/g, ' ').trim();
              currentMessage.transport.vessel = vesselName.replace(/\+/g, ' ').trim();
            } else {
              currentMessage.transport.vessel = vesselInfo.split(':').pop().replace(/\+/g, ' ').trim();
            }
          }
          if (tdtParts[5]) {
            currentMessage.transport.carrier = tdtParts[5].split(':').pop().replace(/\+/g, ' ').trim();
          }
        }
      }

      // Limpiar el array temporal y finalizar mensaje
      if (currentMessage) {
        delete currentMessage.tempTdtSegments;
        messages.push(currentMessage);
        currentMessage = null;
      }
    } else if (currentMessage) {
      // Procesar segmento dentro del mensaje actual
      switch (segmentType) {
        case 'RFF':
          if (parts[1]) {
            const refParts = parts[1].split(':');
            const qualifier = refParts[0];
            const referenceValue = refParts.slice(1).join(':');
            if (qualifier === 'BM' && referenceValue) {
              currentMessage.referenceNumber = referenceValue.replace(/\+/g, ' ').trim();
            } else if (parts[1] === 'BM' && parts[2]) {
              currentMessage.referenceNumber = parts[2].split(':').pop().replace(/\+/g, ' ').trim();
            }
          }
          break;

        case 'BGM':
          if (parts[2]) {
            currentMessage.documentNumber = parts[2];
          }
          break;

        case 'DTM':
          if (parts[1]) {
            const dateParts = parts[1].split(':');
            const qualifier = dateParts[0];
            const dateStr = dateParts[1];
            if (dateStr && dateStr.length === 8) {
              const date = new Date(dateStr.substring(0,4), dateStr.substring(4,6) - 1, dateStr.substring(6,8));
              switch (qualifier) {
                case '342':
                  currentMessage.dates.documentDate = date;
                  break;
                case '132':
                  currentMessage.dates.eta = date;
                  break;
                case '133':
                  currentMessage.dates.etd = date;
                  break;
              }
            }
          }
          break;

        case 'LOC':
          if (parts[1] && parts[2]) {
            const qualifier = parts[1];
            const location = parts[2].split(':').pop().replace(/\+/g, ' ').trim();
            switch (qualifier) {
              case '7':
                currentMessage.destination = location;
                break;
              case '88':
                currentMessage.origin = location;
                break;
              case '91':
                // Origin of goods
                break;
              case '170':
                // Final destination
                currentMessage.destination = location;
                break;
            }
          }
          break;

        case 'NAD':
          if (parts[1] && parts[3]) {
            const qualifier = parts[1];
            const name = parts[3].replace(/\+/g, ' ').trim();
            switch (qualifier) {
              case 'CN':
                currentMessage.client = name;
                break;
              case 'CZ':
                // Shipper
                break;
              case 'N1':
                // Notify
                break;
            }
          }
          break;

        case 'GID':
          if (parts[1]) {
            currentMessage.goods.packages = parseInt(parts[1]) || 1;
          }
          if (parts[2]) {
            currentMessage.goods.packageType = parts[2].split(':')[0];
          }
          break;

        case 'FTX':
          if (parts[1] === 'AAA' && parts[3]) {
            currentMessage.goods.description = parts[3].replace(/\+/g, ' ').trim();
          }
          break;

        case 'EQD':
          if (parts[1] === 'CN' && parts[2]) {
            const container = {
              number: parts[2],
              type: parts[3] || '',
              quantity: parseInt(parts[4]) || 1,
            };
            currentMessage.containers.push(container);
          }
          break;

        case 'MEA':
          if (parts[1] === 'AAE' && parts[2] === 'G' && parts[3]) {
            const weightParts = parts[3].split(':');
            if (weightParts[0] === 'KGM') {
              currentMessage.weight = parseFloat(weightParts[1]) || 0;
            }
          }
          break;

        case 'TDT':
          // Almacenar las partes del segmento TDT para procesarlo al final del mensaje
          currentMessage.tempTdtSegments.push(parts);
          break;

        case 'CUX':
          if (parts[1]) {
            const currencyParts = parts[1].split(':');
            currentMessage.currency = currencyParts[1] || currencyParts[0];
          }
          break;

        case 'MOA':
          if (parts[1] && parts[2]) {
            currentMessage.amounts.push({
              type: parts[1],
              value: parseFloat(parts[2]),
            });
          }
          break;
      }
    }
  });

  // Si hay un mensaje sin cerrar, agregarlo
  if (currentMessage) {
    messages.push(currentMessage);
  }

  // Si no hay mensajes, devolver un array con un mensaje vacío
  if (messages.length === 0) {
    messages.push({
      messageId: '',
      messageType: '',
      documentNumber: 'Sin número',
      origin: 'Origen desconocido',
      destination: 'Destino desconocido',
      client: `EDI ${fileName}`,
      weight: 0,
      status: 'Registrado desde EDI',
      dates: {},
      containers: [],
      transport: {},
      goods: {},
      currency: 'USD',
      amounts: [],
    });
  }

  return messages;
}

export async function listShipments(req, res) {
  try {
    const shipments = await getAllShipments();
    res.json(shipments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener los envíos' });
  }
}

export async function createShipment(req, res) {
  try {
    const payload = req.body;
    if (!payload.origin || !payload.destination || !payload.client) {
      return res.status(400).json({ message: 'Origen, destino y cliente son obligatorios' });
    }

    const shipment = await addShipment(payload);
    res.status(201).json(shipment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear el envío' });
  }
}

export async function parseShipment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo EDI obligatorio' });
    }

    const content = req.file.buffer.toString('utf-8');
    const parsedMessages = parseEdiContent(content, req.file.originalname);

    res.json(parsedMessages);
  } catch (error) {
    console.error('Error al procesar archivo EDI:', error);
    res.status(500).json({
      message: 'Error al procesar el archivo EDI',
      details: error.message,
    });
  }
}

export async function uploadShipment(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Archivo EDI obligatorio' });
    }

    const content = req.file.buffer.toString('utf-8');
    const parsedMessages = parseEdiContent(content, req.file.originalname);

    if (!Array.isArray(parsedMessages) || parsedMessages.length === 0) {
      throw new Error('No se pudieron extraer mensajes del archivo EDI');
    }

    // Verificar que al menos el primer mensaje tenga origen y destino
    const firstMessage = parsedMessages[0];
    if (!firstMessage.origin || !firstMessage.destination) {
      throw new Error('No se pudo extraer origen o destino del archivo EDI');
    }

    const shipment = await addShipment(parsedMessages);
    res.status(201).json(shipment);
  } catch (error) {
    console.error('Error al procesar archivo EDI:', error);
    res.status(500).json({
      message: 'Error al procesar el archivo EDI',
      details: error.message,
    });
  }
}

export async function getShipment(req, res) {
  try {
    const shipment = await findShipment(req.params.id);
    if (!shipment) {
      return res.status(404).json({ message: 'Envío no encontrado' });
    }
    res.json(shipment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al consultar el envío' });
  }
}

export async function updateShipment(req, res) {
  try {
    const shipment = await updateShipmentData(req.params.id, req.body);
    if (!shipment) {
      return res.status(404).json({ message: 'Envío no encontrado' });
    }
    res.json(shipment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar el envío' });
  }
}

export async function deleteShipment(req, res) {
  try {
    const success = await removeShipment(req.params.id);
    if (!success) {
      return res.status(404).json({ message: 'Envío no encontrado' });
    }
    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar el envío' });
  }
}
