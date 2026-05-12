import fs from 'fs';
import path from 'path';
import { parseEdiContent } from './src/controllers/shipmentsController.js';

// Leer archivo de prueba con múltiples mensajes
const testFilePath = path.join(process.cwd(), '..', 'test-edi-multiple.txt');
const ediContent = fs.readFileSync(testFilePath, 'utf8');

console.log('Contenido del archivo EDI con múltiples mensajes:');
console.log(ediContent);
console.log('\n--- Procesando EDI ---\n');

// Probar el parser
try {
  const messages = parseEdiContent(ediContent, 'test-edi-multiple.txt');
  console.log('Mensajes parseados:', JSON.stringify(messages, null, 2));

  // Simular la lógica de detección de discrepancias
  if (messages && Array.isArray(messages)) {
    const vessels = messages
      .map(message => message.transport?.vessel)
      .filter(vessel => vessel && vessel.trim() !== '');

    console.log('\n--- Análisis de Buques ---');
    console.log('Buques encontrados:', vessels);

    if (vessels.length > 1) {
      const uniqueVessels = [...new Set(vessels)];
      if (uniqueVessels.length > 1) {
        console.log('⚠️ DISCREPANCIA DETECTADA:');
        console.log('Buques únicos:', uniqueVessels);
        console.log('Total de mensajes:', vessels.length);
        console.log('Buques únicos:', uniqueVessels.length);
      } else {
        console.log('✅ Todos los mensajes tienen el mismo buque');
      }
    } else {
      console.log('Solo hay un buque o ninguno');
    }
  }
} catch (error) {
  console.error('Error al parsear EDI:', error);
}