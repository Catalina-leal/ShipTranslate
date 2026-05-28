import mongoose from 'mongoose';

// Modelo auxiliar para guardar informacion extraida desde PDFs maritimos.
// Sirve como respaldo de los datos leidos por pdfjs/IA antes de convertir a EDI.
const trackingSchema = new mongoose.Schema(
  {
    sourceFileName: { type: String },
    fileSize: { type: Number },
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    rawText: { type: String },
    metadata: {
      processedByAI: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    collection: 'trackings',
  }
);

const Tracking = mongoose.model('Tracking', trackingSchema);

export async function addTracking(data) {
  return Tracking.create(data);
}
