import crypto from 'crypto';
import express from 'express';
import AccessRequest from '../models/accessRequestModel.js';
import User from '../models/userModel.js';

const router = express.Router();

// Genera el hash de contrasena usando crypto.scrypt.
// Se compara contra el hash almacenado en MongoDB.
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64);
}

// Valida credenciales sin exponer la contrasena real.
function isValidPassword(password, user) {
  const receivedHash = hashPassword(password, user.passwordSalt);
  const storedHash = Buffer.from(user.passwordHash, 'hex');

  return (
    receivedHash.length === storedHash.length &&
    crypto.timingSafeEqual(receivedHash, storedHash)
  );
}

// POST /api/auth/login
// Autentica al usuario y devuelve solo datos seguros: id, nombre, correo y rol.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Correo y contraseña son obligatorios',
      });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    }).exec();

    if (!user || !isValidPassword(password, user)) {
      return res.status(401).json({
        message: 'Credenciales inválidas',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        message: 'La cuenta no está activa',
      });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({
      message: 'Error al iniciar sesión',
    });
  }
});

// POST /api/auth/access-requests
// Recibe solicitudes de crear cuenta o recuperar acceso desde el frontend.
router.post('/access-requests', async (req, res) => {
  try {
    const { type, name, email, company, role, reason, details } = req.body;

    if (!type || !email) {
      return res.status(400).json({
        message: 'Tipo de solicitud y correo son obligatorios',
      });
    }

    if (!['create-account', 'recover-access'].includes(type)) {
      return res.status(400).json({
        message: 'Tipo de solicitud inválido',
      });
    }

    const request = await AccessRequest.create({
      type,
      name,
      email,
      company,
      role,
      reason,
      details,
      status: 'pending',
    });

    return res.status(201).json(request);
  } catch (error) {
    console.error('Error creando solicitud:', error);
    return res.status(500).json({
      message: 'Error al crear la solicitud',
    });
  }
});

// GET /api/auth/access-requests
// Lista solicitudes para que el administrador las revise.
router.get('/access-requests', async (req, res) => {
  try {
    const requests = await AccessRequest.find().sort({ createdAt: -1 }).exec();
    return res.json(requests);
  } catch (error) {
    console.error('Error obteniendo solicitudes:', error);
    return res.status(500).json({
      message: 'Error al obtener solicitudes',
    });
  }
});

// PUT /api/auth/access-requests/:id
// Cambia el estado de una solicitud: approved, rejected, finalized, etc.
router.put('/access-requests/:id', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'finalized'].includes(status)) {
      return res.status(400).json({
        message: 'Estado de solicitud inválido',
      });
    }

    const request = await AccessRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).exec();

    if (!request) {
      return res.status(404).json({
        message: 'Solicitud no encontrada',
      });
    }

    return res.json(request);
  } catch (error) {
    console.error('Error actualizando solicitud:', error);
    return res.status(500).json({
      message: 'Error al actualizar solicitud',
    });
  }
});

export default router;
