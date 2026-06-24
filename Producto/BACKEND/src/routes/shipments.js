import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';
import { createRequire } from 'module';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import dotenv from 'dotenv';
import { addTracking, updateTrackingData } from '../models/trackingModel.js';

dotenv.config();

const require = createRequire(import.meta.url);
const pdfPoppler = require('pdf-poppler');
const { recognize } = require('tesseract.js');

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

function extractPositionedPage(content, viewport) {
  const items = content.items
    .map((item) => {
      const [a, b, c, d, x, y] = item.transform;
      return {
        str: cleanPdfField(item.str),
        x,
        y,
        width: item.width || 0,
        height: item.height || 0,
      };
    })
    .filter((item) => item.str);

  return {
    width: viewport.width,
    height: viewport.height,
    items,
  };
}

function getPositionedLines(layout, box) {
  if (!layout?.items?.length) return [];

  const selectedItems = layout.items
    .filter((item) => {
      const itemEndX = item.x + item.width;
      return item.x >= box.minX &&
        itemEndX <= box.maxX &&
        item.y >= box.minY &&
        item.y <= box.maxY;
    })
    .sort((a, b) => {
      if (Math.abs(b.y - a.y) > 3) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

  const lines = [];

  selectedItems.forEach((item) => {
    const line = lines.find((row) => Math.abs(row.y - item.y) < 3);

    if (line) {
      line.items.push(item);
    } else {
      lines.push({
        y: item.y,
        items: [item],
      });
    }
  });

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) =>
      cleanPdfField(
        line.items
          .sort((a, b) => a.x - b.x)
          .map((item) => item.str)
          .join(' ')
      )
    )
    .filter(Boolean);
}

function getPositionedText(layout, box, separator = ' ') {
  return getPositionedLines(layout, box).join(separator);
}

function getPositionedValueAfterHeader(layout, box, headerPattern) {
  return getPositionedLines(layout, box)
    .filter((line) => !headerPattern.test(line))
    .join(' ');
}

function getUploadedDocumentType(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mimeType = file.mimetype || '';

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    return 'pdf';
  }

  if (
    mimeType.startsWith('image/') ||
    ['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp'].includes(extension)
  ) {
    return 'image';
  }

  return '';
}

async function extractPdfTextFromBuffer(buffer) {
  const loadingTask =
    pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl,
      disableFontFace: true,
    });

  const pdf =
    await loadingTask.promise;

  let text = '';
  const pageTexts = [];
  const pageLayouts = [];

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
    const viewport = page.getViewport({ scale: 1 });

    const pageText = extractTextLines(content);

    pageTexts.push(pageText);
    pageLayouts.push(extractPositionedPage(content, viewport));
    text += pageText;
    text += '\n\n';
  }

  return {
    text,
    pageTexts,
    pageLayouts,
  };
}

async function recognizeImageText(input) {
  const result = await recognize(
    input,
    'eng'
  );

  return cleanOcrText(result?.data?.text || '');
}

function cleanOcrText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractImageTextFromBuffer(buffer) {
  const text = await recognizeImageText(buffer);

  return {
    text,
    pageTexts: [text],
    pageLayouts: [],
  };
}

async function extractScannedPdfTextFromBuffer(buffer) {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'tranship-ocr-')
  );
  const inputPath = path.join(tempDir, 'input.pdf');

  try {
    await fs.writeFile(inputPath, buffer);

    await pdfPoppler.convert(inputPath, {
      format: 'png',
      out_dir: tempDir,
      out_prefix: 'page',
      scale: 2200,
    });

    const imageFiles = (await fs.readdir(tempDir))
      .filter((fileName) => /^page.*\.png$/i.test(fileName))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const pageTexts = [];

    for (const imageFile of imageFiles) {
      const imagePath = path.join(tempDir, imageFile);
      pageTexts.push(await recognizeImageText(imagePath));
    }

    return {
      text: pageTexts.join('\n\n'),
      pageTexts,
      pageLayouts: [],
    };
  } finally {
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });
  }
}

async function extractUploadedDocumentText(file) {
  const documentType = getUploadedDocumentType(file);

  if (documentType === 'image') {
    const ocrResult = await extractImageTextFromBuffer(file.buffer);
    return {
      ...ocrResult,
      extractionMode: 'image-ocr',
    };
  }

  if (documentType !== 'pdf') {
    const error = new Error('Formato no soportado');
    error.statusCode = 400;
    throw error;
  }

  const pdfTextResult = await extractPdfTextFromBuffer(file.buffer);

  if (pdfTextResult.text.trim().length >= 40) {
    return {
      ...pdfTextResult,
      extractionMode: 'pdf-text',
    };
  }

  const ocrResult = await extractScannedPdfTextFromBuffer(file.buffer);
  return {
    ...ocrResult,
    extractionMode: 'pdf-ocr',
  };
}

function getLineAfter(lines, pattern) {
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) return '';
  return lines[index + 1] || '';
}

function isLikelyBlNumber(value) {
  return /^[A-Z0-9][A-Z0-9/-]{5,}$/i.test(value.trim());
}

function extractBlNumber(value) {
  return cleanPdfField(value).match(/\b\d{6}[A-Z]{3}[0-9A-Z/-]+\b/i)?.[0] || '';
}

function cleanPdfField(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatBlIssueDate(value) {
  const match = String(value || '').match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s+(\d{4})\b/i
  );

  if (!match) return '';

  const months = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  const month = months[match[1].slice(0, 3).toLowerCase()];
  const day = match[2].padStart(2, '0');

  return month ? `${day}-${month}-${match[3]}` : '';
}

function collectSection(lines, startPattern, endPattern) {
  const startIndex = lines.findIndex((line) => startPattern.test(line));
  if (startIndex < 0) return [];

  const collected = [];

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (endPattern.test(line)) break;
    collected.push(line);
  }

  return collected;
}

function removeLegalBlText(lines) {
  const legalPattern =
    /shipped on board|indicated|discharge|weight, measure|shipper, are not|lading hereby|conditions of this|must be surrendered|in witness|which being accomplished|others to stand void|shippers are requested|reference to the validity|validity of the insurance|merchants agree|geographical order/i;

  return lines
    .map((line) =>
      line
        .replace(/\s+Shipped on board.*$/i, '')
        .replace(/\s+indicated\).*$/i, '')
        .replace(/\s+In witness whereof.*$/i, '')
        .trim()
    )
    .filter((line) => line && !legalPattern.test(line));
}

function parseVesselVoyageLoading(line) {
  const match = cleanPdfField(line).match(/^(.*?)\s+(V[0-9A-Z-]+)\s+(.+)$/i);

  if (!match) {
    return {
      oceanVessel: cleanPdfField(line),
      voyageNo: '',
      portOfLoading: '',
    };
  }

  return {
    oceanVessel: cleanPdfField(match[1]),
    voyageNo: cleanPdfField(match[2]),
    portOfLoading: cleanPdfField(match[3]),
  };
}

export function metricTonsToKilograms(value) {
  const number = parseFloat(String(value || '').replace(',', '.'));
  if (Number.isNaN(number)) return '';
  return String(Math.round(number * 1000));
}

function findMetricTonWeight(text, preferredLabelPattern = null) {
  const content = String(text || '');
  const unitPattern = '(?:M\\/?T|MT|M\\.T\\.|METRIC\\s+TONS?)';
  const numberPattern = '(\\d+(?:[.,]\\d+)?)';

  if (preferredLabelPattern) {
    const labelMatch = content.match(
      new RegExp(`${preferredLabelPattern}\\s*:?\\s*${numberPattern}\\s*${unitPattern}(?![A-Z])`, 'i')
    );

    if (labelMatch) {
      return labelMatch[1].replace(',', '.');
    }
  }

  const genericMatch = content.match(
    new RegExp(`${numberPattern}\\s*${unitPattern}(?![A-Z])`, 'i')
  );

  return genericMatch ? genericMatch[1].replace(',', '.') : '';
}

export function findBestMetricTonWeight(text) {
  return findMetricTonWeight(text, '(?:TOTAL\\s+)?GROSS\\s+WEIGHT') ||
    findMetricTonWeight(text, 'GROSS\\s+WEIGHT') ||
    findMetricTonWeight(text, '(?:TOTAL\\s+)?NET\\s+WEIGHT') ||
    findMetricTonWeight(text);
}

function convertWeightMetricTonsToKilogramsText(value) {
  return String(value || '').replace(
    /((?:TOTAL\s+)?(?:GROSS|NET)?\s*WEIGHT\s*:?\s*)(\d+(?:[.,]\d+)?)\s*(M\/?T|MT|M\.T\.|METRIC\s+TONS?)(?![A-Z])/gi,
    (_match, label, amount) => `${label}${metricTonsToKilograms(amount)} KG`
  );
}

export function convertAnyMetricTonsToKilogramsText(value) {
  return String(value || '').replace(
    /(\d+(?:[.,]\d+)?)\s*(M\/?T|MT|M\.T\.|METRIC\s+TONS?)(?![A-Z])/gi,
    (_match, amount) => `${metricTonsToKilograms(amount)} KG`
  );
}

export function normalizeMetricTonWeightsInData(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMetricTonWeightsInData(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeMetricTonWeightsInData(item),
      ])
    );
  }

  if (typeof value === 'string') {
    return convertAnyMetricTonsToKilogramsText(value);
  }

  return value;
}

function extractScannedGoodsDescription(text) {
  const lines = String(text || '')
    .split('\n')
    .map(cleanPdfField)
    .filter(Boolean);
  const headerIndex = lines.findIndex((line) =>
    /Marks\s*&\s*Numbers.*Description\s+of\s+goods.*Gross\s+weight/i.test(line)
  );

  if (headerIndex < 0) {
    return '';
  }

  const descriptionLines = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (
      /^\(of which\b/i.test(line) ||
      /^Freight payable as per at\b/i.test(line) ||
      /^CHARTER-PARTY\b/i.test(line) ||
      /^Time used\b/i.test(line) ||
      /^Freight payable at\b/i.test(line) ||
      /^Number of original\b/i.test(line)
    ) {
      break;
    }

    if (!descriptionLines.length) {
      const firstDescriptionMatch = line.match(
        /(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:M\/?T|MT|M\.T\.|METRIC\s+TONS?)\s+OF\b.*?(?:\s+\d+(?:[.,]\d+)?\s*(?:M\/?T|MT|M\.T\.|METRIC\s+TONS?))?$/i
      );

      if (firstDescriptionMatch) {
        const startIndex = firstDescriptionMatch.index || 0;
        const description = line
          .slice(startIndex)
          .replace(/\s+\d+(?:[.,]\d+)?\s*(?:M\/?T|MT|M\.T\.|METRIC\s+TONS?)$/i, '');

        descriptionLines.push(cleanPdfField(description));
        continue;
      }
    }

    descriptionLines.push(line);
  }

  return descriptionLines.join('\n');
}

function enrichScannedBlData(extractedData, text, extractionMode) {
  if (!['pdf-ocr', 'image-ocr'].includes(extractionMode)) {
    return extractedData;
  }

  const scannedDescription = extractScannedGoodsDescription(text);

  if (!scannedDescription) {
    return extractedData;
  }

  const currentDescription = String(extractedData.cargoDescription || '').trim();

  if (
    !currentDescription ||
    scannedDescription.length > currentDescription.length
  ) {
    return {
      ...extractedData,
      cargoDescription: scannedDescription,
    };
  }

  return extractedData;
}

function parsePackageInfo(cargoBlock) {
  const match = cargoBlock.match(/(?:^|\s)(\d{1,6})\s+(?:\d{1,6}\s+)?(BUNDLES|COILS|PACKAGES|UNITS|PCS|PIECES|BAGS|PALLETS)\b/i);
  const splitColumnMatch = cargoBlock.match(/\b(\d{1,6})\s+(?:CLEAN|SHIPPED)\s+ON BOARD\b/i);
  const typeMatch = cargoBlock.match(/\b(BUNDLES|COILS|PACKAGES|UNITS|PCS|PIECES|BAGS|PALLETS)\s+FREIGHT PREPAID\b/i) ||
    cargoBlock.match(/\bIN\s+(BUNDLES|COILS|PACKAGES|UNITS|PCS|PIECES|BAGS|PALLETS)\b/i);

  if (!match) {
    return {
      packages: splitColumnMatch?.[1] || '',
      packageType: typeMatch?.[1]?.toUpperCase() || '',
    };
  }

  return {
    packages: match[1],
    packageType: match[2].toUpperCase(),
  };
}

function normalizeGoodsLine(line, packageType) {
  const cleaned = cleanPdfField(line);
  if (!cleaned || /^Units$/i.test(cleaned) || /^Net Weight$/i.test(cleaned)) {
    return '';
  }

  const duplicatedPackageMatch = cleaned.match(
    /^(\d{1,6})\s+\d{1,6}\s+(BUNDLES|COILS|PACKAGES|UNITS|PCS|PIECES|BAGS|PALLETS)\b/i
  );
  if (duplicatedPackageMatch) {
    return `${duplicatedPackageMatch[1]} ${duplicatedPackageMatch[2].toUpperCase()}`;
  }

  if (packageType) {
    const packagePrefix = new RegExp(`^${packageType}\\s+`, 'i');
    return cleaned.replace(packagePrefix, '').trim();
  }

  return cleaned;
}

function parseCargoDetails(cargoLines) {
  const relevantLines = cargoLines
    .map(cleanPdfField)
    .filter((line) => line && !/^Units$/i.test(line));
  const cargoBlock = relevantLines.join(' ');
  const grossWeightMetricTons = findBestMetricTonWeight(cargoBlock);
  const packageInfo = parsePackageInfo(cargoBlock);
  const descriptionStartPattern = /\b(PRIME|HOT|COLD|GALVANIZED|STEEL|WIRE|PLATE|COIL|SHEET)\b/i;
  const firstDescriptionIndex = relevantLines.findIndex((line) =>
    descriptionStartPattern.test(line)
  );
  const firstDescriptionLine = firstDescriptionIndex >= 0
    ? relevantLines[firstDescriptionIndex]
    : '';
  const descriptionStartMatch = firstDescriptionLine.match(descriptionStartPattern);
  const descriptionStart = descriptionStartMatch?.index ?? -1;
  const marksFromFirstLine = descriptionStart >= 0
    ? firstDescriptionLine.slice(0, descriptionStart)
    : '';
  const firstGoodsLine = descriptionStart >= 0
    ? firstDescriptionLine
        .slice(descriptionStart)
        .replace(/\s+\d+(?:[.,]\d+)?\s*MT\b.*$/i, '')
    : '';
  const followingLines = firstDescriptionIndex >= 0
    ? relevantLines.slice(firstDescriptionIndex + 1)
    : [];
  const splitFollowingLines = followingLines.reduce(
    (acc, line) => {
      const operationalMatch = line.match(/\b(CLEAN ON BOARD|SHIPPED ON BOARD|SHIPPING UNDER DECK|IN TERMS\b.*|THE AMOUNT OF FREIGHT:?.*|PURCHASE ORDER NUMBER:?.*|FREIGHT PREPAID|TOTAL NET WEIGHT:?.*)\b/i);

      if (operationalMatch && operationalMatch.index > 0) {
        const beforeOperational = line.slice(0, operationalMatch.index).trim();

        if (
          beforeOperational &&
          beforeOperational.toUpperCase() !== packageInfo.packageType
        ) {
          acc.marks.push(beforeOperational);
        }
        acc.goods.push(operationalMatch[0]);
        return acc;
      }

      if (/^\d+(?:[.,]\d+)?\s*MT\b/i.test(line)) {
        return acc;
      }

      const packageLinePattern = new RegExp(
        `\\b\\d{1,6}\\s+\\d{1,6}\\s+${packageInfo.packageType || '(?:BUNDLES|COILS|PACKAGES|UNITS|PCS|PIECES|BAGS|PALLETS)'}\\b`,
        'i'
      );
      const packageMatch = line.match(packageLinePattern);

      if (packageMatch) {
        if (packageMatch.index > 0) {
          acc.marks.push(line.slice(0, packageMatch.index));
        }
        acc.goods.push(packageMatch[0]);

        const afterPackage = line.slice(packageMatch.index + packageMatch[0].length);
        if (afterPackage) acc.goods.push(afterPackage);
        return acc;
      }

      const packagePrefixPattern = packageInfo.packageType
        ? new RegExp(`^${packageInfo.packageType}\\b\\s*(.*)$`, 'i')
        : null;
      const packagePrefixMatch = packagePrefixPattern
        ? line.match(packagePrefixPattern)
        : null;

      if (packagePrefixMatch) {
        if (packagePrefixMatch[1]) acc.goods.push(packagePrefixMatch[1]);
        return acc;
      }

      if (/^L\/C NUMBER|^FREIGHT PREPAID|^TOTAL NET WEIGHT|^CLEAN ON BOARD|^SHIPPED ON BOARD|^SHIPPING UNDER DECK|^IN TERMS\b|^TPV TERMINAL\b|^THE AMOUNT OF FREIGHT|^PURCHASE ORDER NUMBER/i.test(line)) {
        acc.goods.push(line);
        return acc;
      }

      if (descriptionStartPattern.test(line)) {
        acc.goods.push(line);
        return acc;
      }

      acc.marks.push(line);
      return acc;
    },
    { marks: [], goods: [] }
  );
  const goodsLines = [
    firstGoodsLine,
    ...splitFollowingLines.goods,
  ]
    .map((line) => normalizeGoodsLine(line, packageInfo.packageType))
    .map(convertWeightMetricTonsToKilogramsText)
    .filter((line) =>
      line &&
      !/^TOTAL NUMBER OF PACKAGES/i.test(line) &&
      !/^UNIT \(IN WORDS\)/i.test(line) &&
      !/^Of which/i.test(line)
    );
  const packageSummary = packageInfo.packages && packageInfo.packageType
    ? `${packageInfo.packages} ${packageInfo.packageType}`
    : '';

  if (
    packageSummary &&
    !goodsLines.some((line) => line.toUpperCase() === packageSummary.toUpperCase())
  ) {
    goodsLines.splice(1, 0, packageSummary);
  }
  const marksLines = [
    marksFromFirstLine,
    ...relevantLines.slice(0, Math.max(firstDescriptionIndex, 0)),
    ...splitFollowingLines.marks,
  ]
    .map(cleanPdfField)
    .filter((line) =>
      line &&
      !/^Units$/i.test(line) &&
      !/L\/C NUMBER|FREIGHT PREPAID|TOTAL NET WEIGHT|CLEAN ON BOARD|SHIPPED ON BOARD/i.test(line)
    );

  return {
    cargoBlock,
    grossWeightMetricTons,
    grossWeightKg: metricTonsToKilograms(grossWeightMetricTons),
    packageInfo,
    marks: marksLines.join(' '),
    description: goodsLines.join('\n'),
  };
}

function parseCongenbillCargoDetails(lines, cargoLines) {
  const relevantLines = cargoLines
    .map(cleanPdfField)
    .filter(Boolean);
  const cargoBlock = relevantLines.join(' ');
  const grossWeightMetricTons = findBestMetricTonWeight(cargoBlock);
  const piecesMatch = cargoBlock.match(/NUMBER OF PIECES:\s*(\d{1,6})\s+(PIECES|PCS)\b/i) ||
    cargoBlock.match(/\b(\d{1,6})\s+(PIECES|PCS)\b/i);
  const shippingMarksLine = relevantLines.find((line) => /^SHIPPING MARKS:/i.test(line)) || '';
  const goodsStartMatch = shippingMarksLine.match(/\b(HOT|COLD|PRIME|STEEL|PLATE|COIL|SHEET|WIRE)\b/i);
  const marks = goodsStartMatch
    ? cleanPdfField(shippingMarksLine.slice(0, goodsStartMatch.index))
    : shippingMarksLine;
  const firstGoodsLine = goodsStartMatch
    ? cleanPdfField(shippingMarksLine.slice(goodsStartMatch.index))
    : '';
  const goodsLines = [
    firstGoodsLine,
    piecesMatch ? `${piecesMatch[1]} ${piecesMatch[2].toUpperCase()}` : '',
    ...relevantLines.filter((line) =>
      /^TOTAL GROSS WEIGHT:/i.test(line) ||
      /^TOTAL NET WEIGHT:/i.test(line) ||
      /^NUMBER OF PIECES:/i.test(line) ||
      /^FREIGHT AMOUNT:/i.test(line) ||
      /^SHIPPED ON BOARD/i.test(line) ||
      /^FREIGHT PREPAID$/i.test(line)
    ),
  ]
    .map(cleanPdfField)
    .map(convertWeightMetricTonsToKilogramsText)
    .filter(Boolean);

  return {
    cargoBlock,
    grossWeightMetricTons,
    grossWeightKg: metricTonsToKilograms(grossWeightMetricTons),
    packageInfo: {
      packages: piecesMatch?.[1] || '',
      packageType: piecesMatch?.[2]?.toUpperCase() || '',
    },
    marks,
    description: [...new Set(goodsLines)].join('\n'),
  };
}

function parseStandardTrampLayout(pageText, layout) {
  if (!layout || /CONGENBILL/i.test(pageText)) {
    return null;
  }

  const cargoMinY = 356;
  const cargoMaxY = 500;
  const shipper = getPositionedValueAfterHeader(
    layout,
    { minX: 0, maxX: 270, minY: 785, maxY: 815 },
    /^(CA FORM|Shipper|B\/L NO\.?|BILL OF LADING)/i
  );
  const blNumber =
    getPositionedValueAfterHeader(
      layout,
      { minX: 400, maxX: 540, minY: 785, maxY: 815 },
      /^B\/L NO\.?/i
    ) || extractBlNumber(pageText);
  const consignee = getPositionedValueAfterHeader(
    layout,
    { minX: 0, maxX: 270, minY: 700, maxY: 725 },
    /^Consignee\b/i
  );
  const notifyParty = removeLegalBlText(
    getPositionedLines(
      layout,
      { minX: 0, maxX: 270, minY: 555, maxY: 640 }
    ).filter((line) => !/^Notify Party\b/i.test(line))
  ).join(' ');
  const oceanVessel = getPositionedValueAfterHeader(
    layout,
    { minX: 0, maxX: 112, minY: 535, maxY: 555 },
    /^Ocean Vessel\b/i
  );
  const voyageNo = getPositionedValueAfterHeader(
    layout,
    { minX: 112, maxX: 175, minY: 535, maxY: 555 },
    /^Voy\. No\./i
  );
  const portOfLoading = getPositionedValueAfterHeader(
    layout,
    { minX: 175, maxX: 275, minY: 535, maxY: 555 },
    /^Port of Loading\b/i
  );
  const portOfDischarge = getPositionedValueAfterHeader(
    layout,
    { minX: 0, maxX: 270, minY: 510, maxY: 532 },
    /^Port of Discharge\b/i
  );
  const marksLines = getPositionedLines(
    layout,
    { minX: 0, maxX: 126, minY: cargoMinY, maxY: cargoMaxY }
  ).filter((line) =>
    !/^Marks \/ Numbers/i.test(line) &&
    !/^Port of Discharge/i.test(line)
  );
  const packagesLines = getPositionedLines(
    layout,
    { minX: 126, maxX: 176, minY: cargoMinY, maxY: cargoMaxY }
  ).filter((line) =>
    !/^No\.of P'kgs/i.test(line) &&
    !/^Units$/i.test(line)
  );
  const goodsLines = getPositionedLines(
    layout,
    { minX: 176, maxX: 488, minY: cargoMinY, maxY: cargoMaxY }
  ).filter((line) =>
    !/^Kind of packages/i.test(line)
  );
  const weightLines = getPositionedLines(
    layout,
    { minX: 488, maxX: 560, minY: cargoMinY, maxY: cargoMaxY }
  ).filter((line) =>
    !/^Gross Weight/i.test(line) &&
    !/^Net Weight/i.test(line)
  );
  const packages = packagesLines.find((line) => /^\d{1,6}$/.test(line)) || '';
  const packageType = packagesLines.find((line) =>
    /^(BUNDLES|COILS|PACKAGES|UNITS|PCS|PIECES|BAGS|PALLETS)$/i.test(line)
  ) || '';
  const packageSummary = packages && packageType
    ? `${packages} ${packageType.toUpperCase()}`
    : '';
  const normalizedGoodsLines = goodsLines
    .map(convertWeightMetricTonsToKilogramsText)
    .filter(Boolean);

  if (
    packageSummary &&
    !normalizedGoodsLines.some((line) => line.toUpperCase() === packageSummary.toUpperCase())
  ) {
    normalizedGoodsLines.splice(1, 0, packageSummary);
  }

  const grossWeightMetricTons = findBestMetricTonWeight([
    ...weightLines,
    ...goodsLines,
  ].join(' '));

  return {
    blNumber,
    shipper,
    consignee,
    notifyParty,
    oceanVessel,
    voyageNo,
    portOfLoading,
    portOfDischarge,
    marksNumbers: marksLines.join(' ') || '',
    packages,
    packageType: packageType.toUpperCase(),
    goodsDescription: normalizedGoodsLines.join('\n'),
    grossWeightMetricTons,
    grossWeightKg: metricTonsToKilograms(grossWeightMetricTons),
  };
}

function parseTrampBlPage(pageText, pageNumber, layout = null) {
  const lines = pageText
    .split('\n')
    .map((line) => cleanPdfField(line))
    .filter(Boolean);

  if (!lines.some((line) => /B\/L NO\.?/i.test(line))) return null;
  if (!lines.some((line) => /Ocean Vessel|Vessel\s+Port of loading/i.test(line))) return null;

  const layoutData = parseStandardTrampLayout(pageText, layout);
  const blHeaderIndex = lines.findIndex((line) => /B\/L NO\./i.test(line));
  const carrierIndex = lines.findIndex((line) => /CARRIER:/i.test(line));
  const consigneeIndex = lines.findIndex((line) => /^Consignee\b/i.test(line));
  const headerEndIndex = carrierIndex > blHeaderIndex
    ? carrierIndex
    : consigneeIndex > blHeaderIndex
      ? consigneeIndex
      : blHeaderIndex + 8;
  const headerCandidates = lines.slice(blHeaderIndex + 1, headerEndIndex);
  const blNumber =
    headerCandidates.find(isLikelyBlNumber) ||
    extractBlNumber(lines[blHeaderIndex]) ||
    extractBlNumber(headerCandidates.join(' ')) ||
    extractBlNumber(pageText);
  const shipperLines = carrierIndex > blHeaderIndex
    ? headerCandidates
    : removeLegalBlText(collectSection(lines, /^Shipper\b/i, /^Consignee\b/i));
  const shipper = shipperLines
    .map((line) => cleanPdfField(line.replace(blNumber, '').replace(/\bTO BE USED WITH CHARTER-PARTIES\b/i, '')))
    .filter((line) => line && line !== blNumber && !/^BILL OF LADING$/i.test(line))
    .join(' ');

  const consignee = removeLegalBlText(
    collectSection(lines, /^Consignee\b/i, /^Notify Party\b|^Notify address\b/i)
  ).join(' ');

  const notifyParty = removeLegalBlText(
    collectSection(lines, /^Notify Party\b|^Notify address\b/i, /^Ocean Vessel\b|^Vessel\s+Port of loading\b/i)
  ).join(' ');

  const vesselLine =
    getLineAfter(lines, /^Ocean Vessel\b/i) ||
    getLineAfter(lines, /^Vessel\s+Port of loading\b/i);
  const vesselData = parseVesselVoyageLoading(vesselLine);
  const portOfDischarge = getLineAfter(lines, /^Port of Discharge\b|^Port of discharge\b/i);

  const cargoStartIndex = lines.findIndex((line) => /^Marks \/ Numbers|^Shipper's description of goods/i.test(line));
  const measurementIndex = lines.findIndex((line) => /^Measurement\b/i.test(line));
  const cargoLines = cargoStartIndex >= 0
    ? lines.slice(cargoStartIndex + 1, measurementIndex > cargoStartIndex ? measurementIndex : undefined)
    : [];
  const isCongenbill = /CONGENBILL/i.test(pageText);
  const cargoDetails = isCongenbill
    ? parseCongenbillCargoDetails(lines, cargoLines)
    : parseCargoDetails(cargoLines);
  const cargoBlock = cargoDetails.cargoBlock;
  const grossWeightMetricTons = cargoDetails.grossWeightMetricTons;
  const grossWeightKg = cargoDetails.grossWeightKg;
  const packageInfo = cargoDetails.packageInfo;
  const description = cargoDetails.description;
  const marks = cargoDetails.marks;
  const measurement = (cargoBlock.match(/(\d+(?:[.,]\d+)?)\s*(?:CBM|M3|MTQ)\b/i)?.[0] || '');
  const prepaidIssueLine = lines.find((line) =>
    /^[A-Z][A-Z\s.,-]+,\s*[A-Z]+(?:\s+[A-Z]+)?\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/.test(line)
  ) || (isCongenbill
    ? lines.find((line) => /[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/.test(line) && /BAYUQUAN|CHINA|VALPARAISO/i.test(line))
    : '') || '';
  const issueDateMatch = prepaidIssueLine.match(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/);
  const issuePlace = issueDateMatch
    ? cleanPdfField(
        prepaidIssueLine
          .slice(0, issueDateMatch.index)
          .replace(/^.*?(?=BAYUQUAN|VALPARAISO|CHINA)/i, '')
      )
    : cleanPdfField(prepaidIssueLine);
  const prepaidAt = '';
  const placeOfIssue = issuePlace;
  const dateOfIssue = formatBlIssueDate(issueDateMatch?.[0] || prepaidIssueLine);
  const placeDateOfIssue = issueDateMatch
    ? cleanPdfField(`${issuePlace} ${dateOfIssue}`)
    : cleanPdfField(prepaidIssueLine);

  return {
    page: pageNumber,
    blNumber: layoutData?.blNumber || blNumber,
    shipper: layoutData?.shipper || shipper,
    consignee: layoutData?.consignee || consignee,
    notifyParty: layoutData?.notifyParty || notifyParty,
    oceanVessel: layoutData?.oceanVessel || vesselData.oceanVessel,
    voyageNo: layoutData?.voyageNo || vesselData.voyageNo,
    portOfLoading: layoutData?.portOfLoading || vesselData.portOfLoading,
    portOfDischarge: layoutData?.portOfDischarge || portOfDischarge,
    marksNumbers: layoutData?.marksNumbers || marks,
    packages: layoutData?.packages || packageInfo.packages,
    packageType: layoutData?.packageType || packageInfo.packageType,
    goodsDescription: layoutData?.goodsDescription || description,
    grossWeightMetricTons: layoutData?.grossWeightMetricTons || grossWeightMetricTons,
    grossWeightKg: layoutData?.grossWeightKg || grossWeightKg,
    measurement,
    prepaidAt,
    placeOfIssue,
    dateOfIssue,
    placeDateOfIssue,
    rawText: pageText,
  };
}

function parseTrampImportBls(pageTexts, pageLayouts = []) {
  return pageTexts
    .map((pageText, index) =>
      parseTrampBlPage(pageText, index + 1, pageLayouts[index])
    )
    .filter((bl) => bl && bl.blNumber);
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

router.put('/trackings/:id', async (req, res) => {
  try {
    const { extractedData } = req.body;

    if (!extractedData || typeof extractedData !== 'object') {
      return res.status(400).json({
        message: 'Datos de tracking obligatorios',
      });
    }

    const tracking = await updateTrackingData(req.params.id, {
      extractedData,
    });

    if (!tracking) {
      return res.status(404).json({
        message: 'Tracking no encontrado',
      });
    }

    return res.json({
      success: true,
      tracking,
    });
  } catch (error) {
    console.error('Error actualizando tracking:', error);
    return res.status(500).json({
      message: 'Error al actualizar tracking',
      details: error.message,
    });
  }
});

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

      const uploadedDocumentType = getUploadedDocumentType(req.file);

      if (!uploadedDocumentType) {
        return res.status(400).json({
          message:
            'Solo se permiten archivos PDF o imagenes',
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

      const {
        text,
        pageTexts,
        pageLayouts,
        extractionMode,
      } = await extractUploadedDocumentText(req.file);

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
      const trampImportBls = parseTrampImportBls(pageTexts, pageLayouts);

      if (openai && trampImportBls.length <= 1) {
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

      if (openai && trampImportBls.length <= 1) {
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

      extractedData = enrichScannedBlData(
        extractedData,
        text,
        extractionMode
      );

      extractedData = normalizeMetricTonWeightsInData(extractedData);

      if (trampImportBls.length > 1) {
        const firstBl = trampImportBls[0] || {};
        extractedData = {
          ...extractedData,
          blNumber: firstBl.blNumber || '',
          shipper: firstBl.shipper || '',
          consignee: firstBl.consignee || '',
          notify: firstBl.notifyParty || '',
          vessel: firstBl.oceanVessel || '',
          voyage: firstBl.voyageNo || '',
          portOfLoading: firstBl.portOfLoading || '',
          portOfDischarge: firstBl.portOfDischarge || '',
          destination: firstBl.portOfDischarge || '',
          marks: firstBl.marksNumbers || '',
          packages: firstBl.packages || '',
          packageType: firstBl.packageType || '',
          cargoDescription: firstBl.goodsDescription || '',
          grossWeight: firstBl.grossWeightKg || '',
          volume: firstBl.measurement || '',
          freight: /FREIGHT PREPAID/i.test(firstBl.goodsDescription || '')
            ? 'FREIGHT PREPAID'
            : '',
          note: '',
          remarks: [
            `Documento tramp importacion con ${trampImportBls.length} BLs detectados.`,
          ],
        };
      }

      /* =========================
         RESPUESTA FINAL
      ========================= */

      const tracking = await addTracking({
        sourceFileName: req.file.originalname,
        fileSize: req.file.size,
        extractedData: {
          ...extractedData,
          bls: trampImportBls,
          blCount: trampImportBls.length,
          documentType: trampImportBls.length > 1 ? 'tramp-import' : '',
        },
        rawText: text,
        metadata: {
          processedByAI: Boolean(openai),
          extractionMode,
          sourceType: uploadedDocumentType,
        },
      });

      return res.json({
        success: true,
        trackingId: tracking._id,
        bls: trampImportBls,
        blCount: trampImportBls.length,
        documentType: trampImportBls.length > 1 ? 'tramp-import' : '',
        extractionMode,
        sourceType: uploadedDocumentType,
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

      if (error?.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
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
