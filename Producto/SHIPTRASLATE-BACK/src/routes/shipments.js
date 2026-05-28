import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import dotenv from 'dotenv';
import { addTracking } from '../models/trackingModel.js';

dotenv.config();

import {
  createShipment,
  deleteShipment,
  getShipment,
  listShipments,
  parseShipment,
  updateShipment,
  uploadShipment,
} from '../controllers/shipmentsController.js';

const router = express.Router();

// Este archivo define las rutas REST de EDI, PDF y shipments.
// Las funciones complejas de negocio viven en controllers y models.

/* =========================
   MULTER
========================= */

// Multer recibe archivos en memoria para procesarlos sin guardarlos en disco.
const upload = multer({
  storage: multer.memoryStorage(),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfWorkerPath = new URL(
  '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).href;
const standardFontDataUrl = new URL(
  '../../node_modules/pdfjs-dist/standard_fonts/',
  import.meta.url
).href;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerPath;
pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = standardFontDataUrl;

/* =========================
   OPENAI
========================= */

// Cliente OpenAI usado para convertir texto de PDF en JSON logistico.
let openai = null;

if (process.env.OPENAI_API_KEY) {

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log(
    'OpenAI inicializado correctamente ✅'
  );

} else {

  console.log(
    'OPENAI_API_KEY faltante ❌'
  );
}

/* =========================
   LIMPIAR JSON IA
========================= */

function cleanJsonResponse(text) {

  if (!text) return '{}';

  return text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

// Ordena el texto extraido del PDF por coordenadas para reconstruir lineas legibles.
function extractTextLines(content) {
  const items = content.items.map((item) => {
    const [a, b, c, d, x, y] = item.transform;
    return {
      str: item.str,
      x,
      y,
    };
  });

  items.sort((a, b) => {
    if (Math.abs(b.y - a.y) > 2) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const lines = [];

  items.forEach((item) => {
    const line = lines.find(
      (row) => Math.abs(row.y - item.y) < 3
    );

    if (line) {
      line.items.push(item);
    } else {
      lines.push({
        y: item.y,
        items: [item],
      });
    }
  });

  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((line) =>
      line.items
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str)
        .join(' ')
    )
    .join('\n');
}

/* =========================
   CRUD SHIPMENTS
========================= */

// GET /api/shipments: historico de EDIs guardados.
router.get('/', listShipments);

// POST /api/shipments: crea un shipment desde JSON.
router.post('/', createShipment);

// POST /api/shipments/parse: parsea un archivo EDI sin guardarlo definitivamente.
router.post(
  '/parse',
  upload.single('ediFile'),
  parseShipment
);


// POST /api/shipments/upload: parsea/recibe un EDI y lo guarda en MongoDB.
router.post(
  '/upload',
  upload.single('ediFile'),
  uploadShipment
);

// GET /api/shipments/:id: obtiene el detalle de un EDI guardado.
router.get('/:id', getShipment);

// PUT /api/shipments/:id: actualiza un EDI editado.
router.put('/:id', updateShipment);

// DELETE /api/shipments/:id: elimina un EDI del historico.
router.delete('/:id', deleteShipment);


/* =========================
   PDF PARSER + IA
========================= */

// POST /api/shipments/parse-pdf: lee un BL en PDF, extrae texto y usa IA
// para devolver campos logisticos estructurados.
router.post(
  '/parse-pdf',
  upload.single('pdfFile'),

  async (req, res) => {

    try {

      /* =========================
         VALIDAR PDF
      ========================= */

      if (!req.file) {

        return res.status(400).json({
          message:
            'No se subió ningún PDF',
        });
      }

      /* =========================
         VALIDAR OPENAI
      ========================= */

      if (!openai) {
        console.warn(
          'OPENAI no configurado: parse-pdf devolverá texto extraído sin IA.'
        );
      }

      /* =========================
         LEER PDF
      ========================= */

      const loadingTask =
        pdfjsLib.getDocument({
          data: new Uint8Array(
            req.file.buffer
          ),
          standardFontDataUrl,
          disableFontFace: true,
        });

      const pdf =
        await loadingTask.promise;

      let text = '';

      for (
        let i = 1;
        i <= pdf.numPages;
        i++
      ) {

        const page =
          await pdf.getPage(i);

        const content =
          await page.getTextContent({
            normalizeWhitespace: true,
          });

        const pageText = extractTextLines(content);

        text += pageText;
        text += '\n\n';
      }

      /* =========================
         VALIDAR TEXTO
      ========================= */

      if (!text.trim()) {

        return res.status(400).json({
          message:
            'No se pudo leer texto del PDF',
        });
      }

      /* =========================
         IA
      ========================= */

      let rawContent = '{}';
      let cleanedContent = '{}';

      if (openai) {
        const aiResponse =
          await openai.chat.completions.create({

            model: 'gpt-4.1-mini',

            temperature: 0,

            response_format: {
              type: 'json_object',
            },

            messages: [

              {
                role: 'system',

                content: `
Eres un parser experto en Bills of Lading y logística internacional.

Debes leer texto de PDFs marítimos y devolver SOLO JSON válido.

Extrae toda la informacion disponible. Si un dato no existe, usa string vacio, array vacio u objeto vacio.
No inventes informacion.

Devuelve exactamente esta estructura:

{
  "blNumber": "",
  "bookingNumber": "",
  "documentDate": "",
  "eta": "",
  "etd": "",
  "shipper": "",
  "consignee": "",
  "notify": "",
  "vessel": "",
  "voyage": "",
  "lloyd": "",
  "carrier": "",
  "origin": "",
  "portOfLoading": "",
  "portOfDischarge": "",
  "destination": "",
  "transshipment": "",
  "places": [],
  "containers": [
    {
      "number": "",
      "type": "",
      "seal": "",
      "seals": [],
      "grossWeight": "",
      "netWeight": "",
      "volume": "",
      "packages": "",
      "packageType": "",
      "movementType": "",
      "temperature": "",
      "imoClass": "",
      "unNumber": ""
    }
  ],
  "cargoDescription": "",
  "marks": "",
  "packages": "",
  "packageType": "",
  "grossWeight": "",
  "netWeight": "",
  "volume": "",
  "freight": "",
  "incoterm": "",
  "freightCondition": "",
  "hsCode": "",
  "references": [],
  "charges": [],
  "remarks": []
}

NO expliques nada.
NO uses markdown.
NO uses triple backticks.
SOLO JSON válido.
                `,
              },

              {
                role: 'user',
                content: text,
              },
            ],
          });

        /* =========================
           RESPUESTA IA
        ========================= */

        rawContent =
          aiResponse.choices?.[0]
            ?.message?.content || '{}';

        cleanedContent =
          cleanJsonResponse(rawContent);
      }

      let extractedData = {
        blNumber: '',
        bookingNumber: '',
        shipper: '',
        consignee: '',
        notify: '',
        vessel: '',
        voyage: '',
        lloyd: '',
        carrier: '',
        origin: '',
        portOfLoading: '',
        portOfDischarge: '',
        destination: '',
        transshipment: '',
        places: [],
        containers: [],
        cargoDescription: '',
        marks: '',
        packages: '',
        packageType: '',
        grossWeight: '',
        netWeight: '',
        volume: '',
        freight: '',
        incoterm: '',
        freightCondition: '',
        hsCode: '',
        references: [],
        charges: [],
        remarks: [],
      };

      if (openai) {
        try {
          extractedData =
            JSON.parse(
              cleanedContent
            );
        } catch (parseError) {
          console.error(
            'Error parseando JSON IA:',
            parseError
          );
          console.error(
            'Contenido recibido:',
            cleanedContent
          );

          return res.status(500).json({
            message:
              'La IA devolvió JSON inválido',
            raw: cleanedContent,
          });
        }
      } else {
        extractedData.note =
          'OpenAI no configurado; solo texto extraído.';
      }

      /* =========================
         RESPUESTA FINAL
      ========================= */

      const tracking = await addTracking({
        sourceFileName: req.file.originalname,
        fileSize: req.file.size,
        extractedData,
        rawText: text,
        metadata: {
          processedByAI: Boolean(openai),
        },
      });

      return res.json({
        success: true,
        trackingId: tracking._id,
        ...extractedData,
        rawText: text,
      });

    } catch (error) {

      console.error(
        'Error procesando PDF:',
        error
      );

      /* =========================
         ERROR CUOTA OPENAI
      ========================= */

      if (
        error?.status === 429 ||
        error?.code ===
          'insufficient_quota'
      ) {

        return res.status(429).json({

          message:
            'Límite de cuota OpenAI excedido',

          details:
            'Debes agregar saldo a OpenAI Platform',
        });
      }

      /* =========================
         ERROR GENERAL
      ========================= */

      return res.status(500).json({

        message:
          'Error procesando PDF',

        details:
          error?.message ||
          'Error desconocido',
      });
    }
  }
);

export default router;
