import mongoose from 'mongoose';

// Modelo MongoDB principal del proyecto.
// Un documento Shipment representa un archivo EDI procesado y puede contener
// uno o varios mensajes/BLs dentro del arreglo ediMessages.
const shipmentSchema = new mongoose.Schema(
  {
    // Datos de auditoria del archivo cargado.
    sourceFileName: { type: String },
    originalContent: { type: String },
    uploadedAt: { type: Date, default: () => new Date() },
    isEdited: { type: Boolean, default: false },
    isMultipleMessages: { type: Boolean, default: false },
    // Usuario que proceso el EDI, usado en historico y administracion.
    processedBy: {
      id: { type: String },
      name: { type: String },
      email: { type: String },
      role: { type: String },
    },
    // Datos del intercambio completo, tomados de UNB y UNZ.
    interchange: {
      syntax: { type: String },
      version: { type: String },
      sender: { type: String },
      receiver: { type: String },
      interchangeId: { type: String },
      interchangeDate: { type: Date },
      totalMessages: { type: Number },
      rawUNB: { type: String },
    },
    // Cada elemento representa un mensaje unitario UNH...UNT, normalmente un BL.
    ediMessages: [
      {
        messageId: { type: String },
        messageType: { type: String },
        documentNumber: { type: String },
        referenceNumber: { type: String },
        status: { type: String },
        // Puertos y ubicaciones relevantes del embarque.
        locations: {
          origin: {
            code: { type: String },
            name: { type: String },
          },
          destination: {
            code: { type: String },
            name: { type: String },
          },
          portOfLoading: {
            code: { type: String },
            name: { type: String },
          },
          referenceLocation: {
            code: { type: String },
            name: { type: String },
          },
          portOfDischarge: {
            code: { type: String },
            name: { type: String },
          },
        },
        // Fechas normalizadas desde segmentos DTM.
        dates: {
          documentDate: { type: Date },
          etd: { type: Date },
          eta: { type: Date },
        },
        // Informacion de viaje, buque y rutas TDT.
        transport: {
          selectedVoyage: { type: String },
          selectedVessel: { type: String },
          selectedLloyd: { type: String },
          selectedCarrier: { type: String },
          selectedETA: { type: Date },
          selectedETD: { type: Date },
          routes: [
            {
              stage: { type: String },
              voyage: { type: String },
              carrier: { type: String },
              vessel: { type: String },
              lloyd: { type: String },
              arrival: {
                location: { type: String },
                eta: { type: Date },
              },
              departure: {
                location: { type: String },
                etd: { type: Date },
              },
            },
          ],
        },
        // Partes involucradas en el BL: shipper, consignee y notify.
        parties: {
          shipper: { type: String },
          consignee: { type: String },
          notify: { type: String },
        },
        // Informacion comercial y fisica de la mercancia.
        goods: {
          description: { type: String },
          hsCode: { type: String },
          marks: { type: String },
          packages: { type: Number },
          packageType: { type: String },
          grossWeight: { type: Number },
          netWeight: { type: Number },
          volume: { type: Number },
          currency: { type: String },
        },
        // Contenedores detectados por EQD, SGP, SEL, TMD y MEA.
        containers: [
          {
            number: { type: String },
            type: { type: String },
            quantity: { type: Number },
            seals: [
              {
                number: { type: String },
                type: { type: String },
              },
            ],
            movementType: { type: String },
            packageQuantity: { type: Number },
            grossWeight: { type: Number },
            volume: { type: Number },
          },
        ],
        transportTerms: {
          incoterm: { type: String },
          freightCondition: { type: String },
        },
        transportServices: {
          serviceType: { type: String },
          priority: { type: String },
        },
        // Cargos detectados en navieras que envian bloques TCC/CUX/PRI/MOA/QTY.
        charges: [
          {
            type: { type: String },
            payerType: { type: String },
            location: { type: String },
            currency: { type: String },
            unitPrice: { type: Number },
            totalAmount: { type: Number },
            quantity: { type: Number },
            containerType: { type: String },
          },
        ],
        // Segmentos originales del mensaje para trazabilidad y revision.
        rawSegments: [{ type: String }],
        summary: {
          vessel: { type: String },
          eta: { type: Date },
          origin: { type: String },
          destination: { type: String },
          mainContainer: { type: String },
        },
      },
    ],
    metadata: {
      processedByAI: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

const Shipment = mongoose.model('Shipment', shipmentSchema);

// Lista el historico de EDIs, del mas reciente al mas antiguo.
export async function getAllShipments() {
  return Shipment.find().sort({ createdAt: -1 }).exec();
}

// Crea un registro Shipment desde datos parseados; acepta un arreglo simple
// o un objeto con interchange + ediMessages.
export async function addShipment(data, options = {}) {
  const { isEdited = false, fileName = '', processedBy = null } = options;
  const baseShipment = {
    sourceFileName: fileName,
    originalContent: '',
    uploadedAt: new Date(),
    isEdited,
    isMultipleMessages: false,
    processedBy: processedBy || undefined,
    interchange: {
      syntax: '',
      version: '',
      sender: '',
      receiver: '',
      interchangeId: '',
      interchangeDate: null,
      totalMessages: 0,
      rawUNB: '',
    },
    ediMessages: [],
    metadata: {
      processedByAI: false,
    },
  };

  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new Error('No hay mensajes EDI para procesar');
    }

    return Shipment.create({
      ...baseShipment,
      isMultipleMessages: data.length > 1,
      ediMessages: data,
    });
  }

  if (data && Array.isArray(data.ediMessages)) {
    return Shipment.create({
      ...baseShipment,
      isMultipleMessages: data.ediMessages.length > 1,
      interchange: data.interchange || baseShipment.interchange,
      originalContent: data.originalContent || '',
      ediMessages: data.ediMessages,
    });
  }

  throw new Error('Datos EDI inválidos para crear shipment');
}

// Busca un EDI guardado por id MongoDB.
export async function findShipment(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Shipment.findById(id).exec();
}

// Actualiza un EDI guardado, por ejemplo despues de editar campos en la vista previa.
export async function updateShipmentData(id, updates) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Shipment.findByIdAndUpdate(id, updates, { new: true }).exec();
}

// Elimina un EDI del historico.
export async function removeShipment(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return false;
  }
  const result = await Shipment.findByIdAndDelete(id).exec();
  return Boolean(result);
}
