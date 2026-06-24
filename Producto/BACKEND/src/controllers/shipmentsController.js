import {
  addShipment,
  findShipment,
  getAllShipments,
  removeShipment,
  updateShipmentData,
} from '../models/shipmentModel.js';

// Este controlador concentra la logica de negocio de los EDI:
// parsea archivos, transforma segmentos EDIFACT en objetos JS y responde a la API.

// Mapeo de codigos de navieras a nombres legibles para mostrar en la interfaz.
const CARRIER_CODE_MAP = {
  'YML': 'YANG MING',
  'AGUNSA': 'AGUNSA',
  'MSC': 'MEDITERRANEAN SHIPPING',
  'EVERGREEN': 'EVERGREEN MARINE',
  'APL': 'AMERICAN PRESIDENT LINES',
  'CMA': 'CMA CGM',
  'MAERSK': 'MAERSK LINE',
  'OOCL': 'ORIENT OVERSEAS',
};

function getCarrierName(code) {
  return CARRIER_CODE_MAP[code?.toUpperCase()] || code || 'Desconocido';
}

// Convierte fechas EDI como 202604300600, 20260430 o 260430 a objetos Date.
// Esto permite que MongoDB guarde fechas reales y el frontend las formatee.
function parseEdiDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const [datePart, timePart] = dateStr.split(/[:.]/);
  let year = null;
  let month = null;
  let day = null;

  if (datePart.length === 12) {
    year = parseInt(datePart.substring(0, 4), 10);
    month = parseInt(datePart.substring(4, 6), 10);
    day = parseInt(datePart.substring(6, 8), 10);
  } else if (datePart.length === 8) {
    year = parseInt(datePart.substring(0, 4), 10);
    month = parseInt(datePart.substring(4, 6), 10);
    day = parseInt(datePart.substring(6, 8), 10);
  } else if (datePart.length === 6) {
    year = 2000 + parseInt(datePart.substring(0, 2), 10);
    month = parseInt(datePart.substring(2, 4), 10);
    day = parseInt(datePart.substring(4, 6), 10);
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.valueOf())) return null;

  const inlineTimePart = datePart.length === 12 ? datePart.substring(8, 12) : '';
  const resolvedTimePart = timePart || inlineTimePart;

  if (resolvedTimePart && /^[0-9]{4}$/.test(resolvedTimePart)) {
    date.setHours(parseInt(resolvedTimePart.substring(0, 2), 10));
    date.setMinutes(parseInt(resolvedTimePart.substring(2, 4), 10));
  }

  return Number.isNaN(date.valueOf()) ? null : date;
}

function parseLocationValue(locationText) {
  if (!locationText || typeof locationText !== 'string') {
    return { code: '', name: '' };
  }

  const raw = locationText.replace(/\+/g, ' ').trim();
  const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);

  if (parts.length === 0) {
    return { code: '', name: '' };
  }

  if (parts.length === 1) {
    return { code: parts[0], name: parts[0] };
  }

  return {
    code: parts[0],
    name: parts.slice(1).join(' '),
  };
}

// Helper para extraer un valor simple desde un segmento cuando se necesita buscar
// por patron. Se mantiene como apoyo para futuras reglas de parsing.
function parseEdiField(text, segment, qualifierPattern) {
  const regex = new RegExp(`${segment}\\+(?:${qualifierPattern})\\+([^'\\r\\n]*)`, 'i');
  const match = text.match(regex);
  if (!match) return null;

  const field = match[1] || '';
  const parts = field.split(/[:+]/).filter(Boolean);
  const value = parts.length ? parts[parts.length - 1] : field;
  return value.replace(/\+/g, ' ').trim();
}

// Funcion principal del parser EDI.
// Entrada: contenido crudo del archivo .edi/.txt.
// Salida: intercambio + arreglo de mensajes EDI estructurados para MongoDB/frontend.
export function parseEdiContent(content, fileName) {
  // EDIFACT separa los segmentos por apostrofe; aqui se normaliza el texto
  // y se obtiene una lista limpia de segmentos individuales.
  const normalizedContent = content.replace(/\r/g, '');
  const segments = normalizedContent
    .split("'")
    .map((s) => s.trim())
    .filter(Boolean);

  // UNB contiene los datos generales del intercambio: emisor, receptor,
  // fecha, version y numero de control.
  const unbSegment = segments.find((s) => s.startsWith('UNB+'));
  let unbData = {
    syntax: '',
    version: '',
    sender: 'Desconocido',
    receiver: 'Desconocido',
    interchangeId: 'N/A',
    interchangeDate: '',
    rawUNB: '',
  };

  if (unbSegment) {
    const unbParts = unbSegment.split('+');
    if (unbParts.length >= 6) {
      const [syntax, version] = (unbParts[1] || '').split(':');
      unbData = {
        syntax: syntax || '',
        version: version || '',
        sender: getCarrierName(unbParts[2]),
        receiver: getCarrierName(unbParts[3]),
        interchangeId: unbParts[5] || '',
        interchangeDate: unbParts[4] || '',
        rawUNB: unbSegment,
      };
    }
  }

  // UNZ cierra el intercambio y declara cuantos mensajes unitarios contiene.
  const unzSegment = segments.find((s) => s.startsWith('UNZ+'));
  const interchange = {
    syntax: unbData.syntax,
    version: unbData.version,
    sender: unbData.sender,
    receiver: unbData.receiver,
    interchangeId: unbData.interchangeId,
    interchangeDate: parseEdiDate(unbData.interchangeDate) || null,
    totalMessages: unzSegment ? parseInt(unzSegment.split('+')[1], 10) || 0 : 0,
    rawUNB: unbData.rawUNB,
  };

  const messages = [];
  let currentMessage = null;
  let currentTransportLeg = null;
  let tempCharge = null;

  // Cuando termina un bloque TDT, se guarda la ruta completa dentro del mensaje.
  const closeCurrentTransportLeg = () => {
    if (!currentTransportLeg || !currentMessage) return;
    currentMessage.transport.routes.push(currentTransportLeg.route);
    currentTransportLeg = null;
  };

  // Cierra un mensaje UNH...UNT, calcula su ruta principal y lo agrega al resultado.
  const closeCurrentMessage = () => {
    if (!currentMessage) return;
    if (tempCharge && Object.keys(tempCharge).length > 0) {
      currentMessage.charges.push(tempCharge);
      tempCharge = null;
    }
    closeCurrentTransportLeg();

    // La ruta visible se toma desde el TDT de mayor etapa (20, 30, 40...).
    // Esta regla es clave para Yang Ming y ONE porque la ETA final puede estar en TDT+40.
    const primaryRoute = currentMessage.transport.routes.reduce((best, route) => {
      if (!best || (route.stage && parseInt(route.stage, 10)) > (parseInt(best.stage, 10) || 0)) {
        return route;
      }
      return best;
    }, null);

    if (primaryRoute) {
      currentMessage.transport.selectedVoyage = primaryRoute.voyage || '';
      currentMessage.transport.selectedCarrier = primaryRoute.carrier || '';
      currentMessage.transport.selectedVessel = primaryRoute.vessel || '';
      currentMessage.transport.selectedLloyd = primaryRoute.lloyd || '';
      currentMessage.transport.selectedETA = primaryRoute.arrival?.eta || null;
      currentMessage.transport.selectedETD = primaryRoute.departure?.etd || null;
    }

    currentMessage.summary = {
      vessel: currentMessage.transport.selectedVessel || '',
      eta: currentMessage.transport.selectedETA || null,
      origin: currentMessage.locations.origin.name || currentMessage.locations.origin.code || '',
      destination: currentMessage.locations.destination.name || currentMessage.locations.destination.code || '',
      mainContainer: currentMessage.containers[0]?.number || '',
    };

    currentMessage.dates.eta = currentMessage.dates.eta || currentMessage.transport.selectedETA;
    currentMessage.dates.etd = currentMessage.dates.etd || currentMessage.transport.selectedETD;

    messages.push(currentMessage);
    currentMessage = null;
  };

// Estructura base de cada BL/mensaje unitario antes de llenar sus datos.
const createEmptyMessage = () => ({
  messageId: '',
  messageType: '',
  documentNumber: 'Sin número',
  referenceNumber: 'Sin referencia',
  status: 'Registrado desde EDI',

  locations: {
    origin: { code: '', name: '' },
    destination: { code: '', name: '' },
    portOfLoading: { code: '', name: '' },
    referenceLocation: { code: '', name: '' },
    portOfDischarge: { code: '', name: '' },
  },

  dates: {
    documentDate: null,
    etd: null,
    eta: null,
  },

  transport: {
    selectedVoyage: '',
    selectedVessel: '',
    selectedLloyd: '',
    selectedCarrier: '',
    selectedETA: null,
    selectedETD: null,
    routes: [],
  },

  parties: {
    shipper: '',
    consignee: '',
    notify: '',
  },

  goods: {
    description: '',
    hsCode: '',
    marks: '',
    packages: 0,
    packageType: '',
    grossWeight: 0,
    netWeight: 0,
    volume: 0,
    currency: 'USD',
  },

  containers: [],

  transportTerms: {
    incoterm: '',
    freightCondition: '',
  },

  transportServices: {
    serviceType: '',
    priority: '',
  },

  charges: [],

  // Montos monetarios encontrados en MOA; se usa para cargos y auditoria.
  amounts: [],

  rawSegments: [],

  summary: {
    vessel: '',
    eta: null,
    origin: '',
    destination: '',
    mainContainer: '',
  },

  client: `EDI ${fileName}`,
});

  const getContainerDetail = (containerId) => {
    let container = currentMessage.containers.find((c) => c.number === containerId);
    if (!container) {
      container = {
        number: containerId,
        type: '',
        status: '',
        quantity: 0,
        seals: [],
        movementType: '',
        packageQuantity: 0,
        grossWeight: 0,
        volume: 0,
      };
      currentMessage.containers.push(container);
    }
    return container;
  };

  // Recorre el EDI segmento por segmento. UNH abre un BL/mensaje unitario y
  // UNT lo cierra; todo lo intermedio se clasifica segun su codigo EDIFACT.
  segments.forEach((segment) => {
    const parts = segment.split('+');
    const segmentType = parts[0];

    if (segmentType === 'UNH') {
      // UNH marca el inicio de un nuevo mensaje individual dentro del intercambio.
      closeCurrentMessage();
      currentTransportLeg = null;
      currentMessage = createEmptyMessage();
      currentMessage.messageId = parts[1] || '';
      currentMessage.messageType = parts[2]?.split(':')[0] || '';
      return;
    }

    if (segmentType === 'UNT') {
      // UNT marca el cierre del mensaje individual y gatilla su consolidacion.
      closeCurrentMessage();
      return;
    }

    if (!currentMessage) {
      return;
    }

    switch (segmentType) {
      case 'RFF': {
        // RFF+BM contiene la referencia BL que se muestra como identificador principal.
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
      }

      case 'BGM':
        // BGM guarda el numero de documento declarado por la naviera.
        if (parts[2]) {
          currentMessage.documentNumber = parts[2];
        }
        break;

      case 'DTM':
        // DTM guarda fechas. 342=documento, 132=ETA/llegada, 133=ETD/salida.
        if (parts[1]) {
          const dateParts = parts[1].split(':');
          const qualifier = dateParts[0];
          const dateStr = dateParts[1];
          const parsedDate = parseEdiDate(dateStr);
          if (parsedDate) {
            switch (qualifier) {
              case '342':
                currentMessage.dates.documentDate = parsedDate;
                break;
              case '132':
                currentMessage.dates.eta = parsedDate;
                if (currentTransportLeg) {
                  currentTransportLeg.arrivalDate = parsedDate;
                  currentTransportLeg.route.arrival.eta = parsedDate;
                }
                break;
              case '133':
                currentMessage.dates.etd = parsedDate;
                if (currentTransportLeg) {
                  currentTransportLeg.departureDate = parsedDate;
                  currentTransportLeg.route.departure.etd = parsedDate;
                }
                break;
            }
          }
        }
        break;

      case 'LOC':
        // LOC clasifica puertos y ubicaciones; si estamos dentro de un TDT,
        // tambien alimenta la ruta de transporte de ese tramo.
        if (parts[1] && parts[2]) {
          const qualifier = parts[1];
          const locationText = parts.slice(2).join('+');
          const parsedLocation = parseLocationValue(locationText);
          switch (qualifier) {
            case '7':
              currentMessage.locations.destination = parsedLocation;
              break;
            case '88':
              currentMessage.locations.origin = parsedLocation;
              break;
            case '76':
              currentMessage.locations.portOfLoading = parsedLocation;
              if (currentTransportLeg) {
                currentTransportLeg.departurePort = parsedLocation.name || parsedLocation.code;
                currentTransportLeg.route.departure.location = parsedLocation.name || parsedLocation.code;
              }
              break;
            case '170':
              currentMessage.locations.portOfDischarge = parsedLocation;
              if (currentTransportLeg) {
                currentTransportLeg.arrivalPort = parsedLocation.name || parsedLocation.code;
                currentTransportLeg.route.arrival.location = parsedLocation.name || parsedLocation.code;
              }
              break;
            case '91':
              currentMessage.locations.referenceLocation = parsedLocation;
              break;
            case '11':
              currentMessage.locations.portOfDischarge = parsedLocation;
              if (currentTransportLeg) {
                currentTransportLeg.arrivalPort = parsedLocation.name || parsedLocation.code;
                currentTransportLeg.route.arrival.location = parsedLocation.name || parsedLocation.code;
              }
              break;
            case '9':
              currentMessage.locations.portOfLoading = parsedLocation;
              if (currentTransportLeg) {
                currentTransportLeg.departurePort = parsedLocation.name || parsedLocation.code;
                currentTransportLeg.route.departure.location = parsedLocation.name || parsedLocation.code;
              }
              break;
          }
          if (tempCharge && ['2', '7', '88', '170', '11', '9', '76'].includes(parts[1])) {
            tempCharge.location = locationText.replace(/\+/g, ' ').trim();
          }
        }
        break;

      case 'NAD':
        // NAD identifica las partes: shipper, consignee y notify.
        if (parts[1]) {
          const qualifier = parts[1];
          const name = parts.slice(3).join('+').replace(/\+/g, ' ').trim() || parts[2] || '';
          switch (qualifier) {
            case 'CN':
              currentMessage.parties.consignee = name;
              break;
            case 'CZ':
              currentMessage.parties.shipper = name;
              break;
            case 'N1':
              currentMessage.parties.notify = name;
              break;
          }
        }
        break;

      case 'GID':
        // GID indica cantidad de bultos y tipo de paquete.
        if (parts[1]) {
          currentMessage.goods.packages = parseInt(parts[1]) || 1;
        }
        if (parts[2]) {
          currentMessage.goods.packageType = parts[2].split(':')[0];
        }
        break;

      case 'FTX':
        // FTX+AAA contiene la descripcion comercial de la mercancia.
        if (parts[1] === 'AAA' && parts.length > 3) {
          currentMessage.goods.description = parts.slice(3).join('+').replace(/\+/g, ' ').trim();
        }
        break;

      case 'PIA':
        // PIA suele traer el codigo arancelario HS.
        if (parts[2]) {
          const hsParts = parts[2].split(':');
          currentMessage.goods.hsCode = hsParts[0] || currentMessage.goods.hsCode;
        }
        break;

      case 'PCI':
        // PCI contiene marcas o numeracion de la carga.
        if (parts[2]) {
          currentMessage.goods.marks = parts[2].replace(/\+/g, ' ').trim();
        }
        break;

      case 'EQD':
        // EQD crea el registro del contenedor: numero, tipo y estado.
        if (parts[1] === 'CN' && parts[2]) {
          const container = {
            number: parts[2],
            type: parts[3] || '',
            quantity: parseInt(parts[4]) || 1,
            seals: [],
            movementType: '',
            packageQuantity: 0,
            grossWeight: 0,
            volume: 0,
          };
          currentMessage.containers.push(container);
        }
        break;

      case 'MEA':
        // MEA guarda medidas; aqui se captura peso bruto en kilogramos.
        if (parts[1] === 'AAE' && parts[2] === 'G' && parts[3]) {
          const weightParts = parts[3].split(':');
          if (weightParts[0] === 'KGM') {
            currentMessage.goods.grossWeight = parseFloat(weightParts[1]) || currentMessage.goods.grossWeight;
          }
        }
        break;

      case 'TDT':
        // TDT inicia un tramo de transporte. Puede existir TDT+20, TDT+30,
        // TDT+40, etc.; el mayor representa el tramo final para la ETA visible.
        if (currentMessage) {
          if (currentTransportLeg && currentTransportLeg.route) {
            currentMessage.transport.routes.push(currentTransportLeg.route);
          }

          const route = {
            stage: parts[1] || '',
            voyage: parts[2] || '',
            carrier: parts[5]?.split(':').pop().replace(/\+/g, ' ').trim() || '',
            vessel: '',
            lloyd: '',
            arrival: { location: '', eta: null },
            departure: { location: '', etd: null },
          };

          currentTransportLeg = {
            sequence: parseInt(parts[1], 10) || 0,
            type: parts[2] || '',
            carrier: route.carrier,
            loyd: '',
            voyage: parts[2] || '',
            vessel: '',
            departurePort: '',
            arrivalPort: '',
            departureDate: null,
            arrivalDate: null,
            route,
          };

          if (parts[8]) {
            const vesselInfo = parts[8];
            if (vesselInfo.includes(':::')) {
              const [loydCode, vesselName] = vesselInfo.split(':::');
              currentTransportLeg.loyd = loydCode.replace(/\+/g, ' ').trim();
              currentTransportLeg.vessel = vesselName.replace(/\+/g, ' ').trim();
              currentTransportLeg.route.lloyd = currentTransportLeg.loyd;
              currentTransportLeg.route.vessel = currentTransportLeg.vessel;
            } else {
              currentTransportLeg.vessel = vesselInfo.split(':').pop().replace(/\+/g, ' ').trim();
              currentTransportLeg.route.vessel = currentTransportLeg.vessel;
            }
          }
        }
        break;

      case 'TSR':
        // TSR define requisitos o prioridad del servicio de transporte.
        if (parts[1]) {
          currentMessage.transportServices.serviceType = parts[1];
        }
        if (parts[2]) {
          currentMessage.transportServices.priority = parts[2];
        }
        break;

      case 'TOD':
        // TOD guarda condiciones comerciales: incoterm y flete prepaid/collect.
        if (parts[1] === '1' && parts[2]) {
          currentMessage.transportTerms.incoterm = parts[2];
        }
        if (parts[1] === '5' && parts[2]) {
          const paymentCode = parts[2];
          currentMessage.transportTerms.freightCondition =
            paymentCode === 'PP'
              ? 'Prepaid'
              : paymentCode === 'CC'
              ? 'Collect'
              : paymentCode;
        }
        break;

      case 'TCC':
        // TCC abre un bloque de cargos; los segmentos siguientes completan precio,
        // moneda, cantidad, ubicacion y monto.
        if (parts[1]) {
          if (tempCharge && Object.keys(tempCharge).length > 0) {
            currentMessage.charges.push(tempCharge);
          }
          const chargeParts = parts[1].split(':');
          tempCharge = {
            type: chargeParts[0] || '',
            payerType: chargeParts[1] || '',
            location: '',
            currency: '',
            unitPrice: 0,
            totalAmount: 0,
            quantity: 0,
            containerType: '',
          };
        }
        break;

      case 'PRI':
        // PRI guarda precio unitario del cargo activo.
        if (parts[1] && tempCharge) {
          const priceParts = parts[1].split(':');
          tempCharge.unitPrice = parseFloat(priceParts[1]) || 0;
        }
        break;

      case 'QTY':
        // QTY guarda cantidad y tipo de contenedor asociado al cargo activo.
        if (parts[1] && tempCharge) {
          const qtyParts = parts[1].split(':');
          tempCharge.quantity = parseInt(qtyParts[0]) || 0;
          tempCharge.containerType = qtyParts[1] || tempCharge.containerType;
        }
        break;

      case 'CUX':
        // CUX define moneda, normalmente USD en los cargos.
        if (parts[1]) {
          const currencyParts = parts[1].split(':');
          const currency = currencyParts[1] || currencyParts[0];
          currentMessage.goods.currency = currency;
          if (tempCharge) {
            tempCharge.currency = currency;
          }
        }
        break;

        case 'MOA':
          // MOA registra monto monetario total y lo asocia al cargo activo.
          if (parts[1] && parts[2]) {
          
            currentMessage.amounts.push({
              type: parts[1],
              value: parseFloat(parts[2]) || 0,
            });
          
            if (tempCharge) {
              tempCharge.totalAmount =
                parseFloat(parts[2]) || 0;
            }
          }
          break;

      case 'SGP':
        // SGP relaciona la mercancia con un contenedor y cantidad de bultos.
        if (parts[1] && parts[2]) {
        
          // Buscar contenedor ya creado por EQD
          const container = currentMessage.containers.find(
            (c) => c.number === parts[1]
          );
        
          // SOLO actualizar si existe
          if (container) {
            container.packageQuantity = parseInt(parts[2], 10) || 0;
          }
        }
        break;

      case 'SEL':
        // SEL agrega sellos al ultimo contenedor leido.
        if (parts[1]) {
          const lastContainer = currentMessage.containers[currentMessage.containers.length - 1];
          if (lastContainer) {
            lastContainer.seals.push({
              number: parts[1],
              type: parts[2] || '',
            });
          }
        }
        break;

      case 'TMD':
        // TMD guarda el tipo de movimiento del contenedor.
        if (parts[1]) {
          const lastContainer = currentMessage.containers[currentMessage.containers.length - 1];
          if (lastContainer) {
            lastContainer.movementType = parts[1];
          }
        }
        break;
    }

    if (currentMessage) {
      // Se conserva el segmento original para auditoria y trazabilidad.
      currentMessage.rawSegments.push(segment);
    }
  });

  if (currentMessage) {
    closeCurrentMessage();
  }

  return {
    interchange,
    ediMessages: messages,
    originalContent: normalizedContent,
  };
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

    if (
      !payload.origin ||
      !payload.destination ||
      !payload.client
    ) {

      return res.status(400).json({
        message:
          'Origen, destino y cliente son obligatorios',
      });
    }

    const shipment =
      await addShipment(payload);

    res.status(201).json(shipment);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message:
        'Error al crear el envío',
    });
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

    const isEdited = req.body.isEdited === 'true' || req.body.isEdited === true;
    const processedBy = req.body.processedBy
      ? JSON.parse(req.body.processedBy)
      : null;
    let parsedData;

    if (req.body.editedData) {
      parsedData = JSON.parse(req.body.editedData);
    } else {
      const content = req.file.buffer.toString('utf-8');
      parsedData = parseEdiContent(content, req.file.originalname);
    }

    const ediPayload =
      parsedData && !Array.isArray(parsedData) && Array.isArray(parsedData.ediMessages)
        ? parsedData
        : { ediMessages: parsedData };

    if (!ediPayload.ediMessages || ediPayload.ediMessages.length === 0) {
      throw new Error('No se pudieron extraer mensajes del archivo EDI');
    }

    // Verificar que al menos el primer mensaje tenga origen y destino
    const firstMessage = ediPayload.ediMessages[0];
    const origin =
      firstMessage.origin ||
      firstMessage.locations?.origin?.code ||
      firstMessage.locations?.origin?.name;
    const destination =
      firstMessage.destination ||
      firstMessage.locations?.destination?.code ||
      firstMessage.locations?.destination?.name;

    if (!origin || !destination) {
      throw new Error('No se pudo extraer origen o destino del archivo EDI');
    }

    const shipment = await addShipment(ediPayload, {
      isEdited,
      fileName: req.file.originalname,
      processedBy,
    });
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
