import { parseEdiContent } from './BACKEND/src/controllers/shipmentsController.js';
import fs from 'fs';
const content = fs.readFileSync('./test-edi-multiple.txt', 'utf8');
const parsed = parseEdiContent(content, 'test-edi-multiple.txt');
console.log(JSON.stringify(parsed, null, 2));
