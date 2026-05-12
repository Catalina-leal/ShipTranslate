import fs from 'fs';
import path from 'path';
import { parseEdiContent } from './src/controllers/shipmentsController.js';

// Leer archivo de prueba
const testFilePath = path.join(process.cwd(), '..', 'test-edi.txt');
const ediContent = fs.readFileSync(testFilePath, 'utf8');

console.log('Contenido del archivo EDI:');
console.log(ediContent);
console.log('\n--- Procesando EDI ---\n');

// Probar el parser
try {
  const messages = parseEdiContent(ediContent, 'test-edi.txt');
  console.log('Mensajes parseados:', JSON.stringify(messages, null, 2));
} catch (error) {
  console.error('Error al parsear EDI:', error);
}