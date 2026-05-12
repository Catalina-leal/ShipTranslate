import express from 'express';
import multer from 'multer';
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
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', listShipments);
router.post('/', createShipment);
router.post('/parse', upload.single('ediFile'), parseShipment);
router.post('/upload', upload.single('ediFile'), uploadShipment);
router.get('/:id', getShipment);
router.put('/:id', updateShipment);
router.delete('/:id', deleteShipment);

export default router;
