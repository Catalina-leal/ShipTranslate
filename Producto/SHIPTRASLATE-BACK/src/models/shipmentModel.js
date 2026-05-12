import mongoose from 'mongoose';

const shipmentSchema = new mongoose.Schema(
  {
    documentNumber: { type: String, required: true },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    client: { type: String, required: true },
    weight: { type: Number, default: 0 },
    status: { type: String, default: 'En preparación' },
    dates: {
      documentDate: { type: Date },
      eta: { type: Date },
      etd: { type: Date },
    },
    containers: [{
      number: { type: String },
      type: { type: String },
      quantity: { type: Number },
    }],
    transport: {
      loyd: { type: String },
      voyage: { type: String },
      vessel: { type: String },
      carrier: { type: String },
    },
    goods: {
      description: { type: String },
      packages: { type: Number },
      packageType: { type: String },
    },
    currency: { type: String },
    amounts: [{
      type: { type: String },
      value: { type: Number },
    }],
    // Nuevos campos para múltiples mensajes EDI
    isMultipleMessages: { type: Boolean, default: false },
    ediMessages: [{
      messageId: { type: String },
      messageType: { type: String },
      documentNumber: { type: String },
      referenceNumber: { type: String },
      origin: { type: String },
      destination: { type: String },
      client: { type: String },
      weight: { type: Number },
      status: { type: String },
      dates: {
        documentDate: { type: Date },
        eta: { type: Date },
        etd: { type: Date },
      },
      containers: [{
        number: { type: String },
        type: { type: String },
        quantity: { type: Number },
      }],
      transport: {
        loyd: { type: String },
        voyage: { type: String },
        vessel: { type: String },
        carrier: { type: String },
      },
      goods: {
        description: { type: String },
        packages: { type: Number },
        packageType: { type: String },
      },
      currency: { type: String },
      amounts: [{
        type: { type: String },
        value: { type: Number },
      }],
    }],
  },
  {
    timestamps: true,
  }
);

const Shipment = mongoose.model('Shipment', shipmentSchema);

export async function getAllShipments() {
  return Shipment.find().sort({ createdAt: -1 }).exec();
}

export async function addShipment(data) {
  // Si data es un array de mensajes EDI, crear un envío múltiple
  if (Array.isArray(data)) {
    const messages = data;
    if (messages.length === 0) {
      throw new Error('No hay mensajes EDI para procesar');
    }

    // Usar el primer mensaje como datos principales del envío
    const firstMessage = messages[0];

    return Shipment.create({
      documentNumber: firstMessage.documentNumber || 'Sin número',
      origin: firstMessage.origin,
      destination: firstMessage.destination,
      client: firstMessage.client,
      weight: firstMessage.weight || 0,
      status: firstMessage.status || 'En preparación',
      dates: firstMessage.dates || {},
      containers: firstMessage.containers || [],
      transport: firstMessage.transport || {},
      goods: firstMessage.goods || {},
      currency: firstMessage.currency,
      amounts: firstMessage.amounts || [],
      isMultipleMessages: messages.length > 1,
      ediMessages: messages,
    });
  } else {
    // Envío único (compatibilidad hacia atrás)
    return Shipment.create({
      documentNumber: data.documentNumber || 'Sin número',
      origin: data.origin,
      destination: data.destination,
      client: data.client,
      weight: data.weight || 0,
      status: data.status || 'En preparación',
      dates: data.dates || {},
      containers: data.containers || [],
      transport: data.transport || {},
      goods: data.goods || {},
      currency: data.currency,
      amounts: data.amounts || [],
      isMultipleMessages: false,
      ediMessages: [],
    });
  }
}

export async function findShipment(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Shipment.findById(id).exec();
}

export async function updateShipmentData(id, updates) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Shipment.findByIdAndUpdate(id, updates, { new: true }).exec();
}

export async function removeShipment(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return false;
  }
  const result = await Shipment.findByIdAndDelete(id).exec();
  return Boolean(result);
}
