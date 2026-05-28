import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAccessRequest } from '../services/api.js';

// Pantalla para solicitar una nueva cuenta.
// No crea usuarios directamente: deja una solicitud pendiente para el administrador.
function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
    reason: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    // Crea una solicitud tipo create-account en MongoDB.
    event.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.company.trim() ||
      !formData.role.trim()
    ) {
      setError('Completa los campos obligatorios para enviar la solicitud.');
      return;
    }

    setError('');

    try {
      await createAccessRequest({
        type: 'create-account',
        name: formData.name,
        email: formData.email,
        company: formData.company,
        role: formData.role,
        reason: formData.reason,
      });
      setSubmitted(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'No se pudo enviar la solicitud.'
      );
    }
  }

  return (
    <section className="register-page">
      <div className="login-background-gradient" />

      <div className="register-layout">
        <div className="register-copy">
          <div className="hero-badge">
            <span className="badge-dot" />
            Solicitud de acceso
          </div>

          <h1 className="hero-title">
            Crea tu cuenta en{' '}
            <span className="hero-title-accent">
              ShipTranslate
            </span>
          </h1>

          <p className="hero-description">
            Completa tus datos para solicitar acceso a la plataforma. La
            información enviada quedará en revisión y deberá ser aprobada por
            un administrador antes de habilitar el ingreso.
          </p>

          <div className="register-review-box">
            <strong>Revisión administrativa</strong>
            <span>
              Tu cuenta no se activa automáticamente. El administrador validará
              los datos de empresa, rol operativo y necesidad de acceso.
            </span>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <div className="login-icon-wrapper">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>

            <div>
              <h2>Crear cuenta</h2>
              <p>Envía tus datos para revisión del administrador.</p>
            </div>
          </div>

          {submitted ? (
            <div className="register-success">
              <strong>Solicitud enviada</strong>
              <p>
                Tu información quedó registrada para revisión. Cuando el
                administrador apruebe la cuenta, podrás iniciar sesión.
              </p>

              <button
                className="login-submit"
                type="button"
                onClick={() => navigate('/login')}
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="register-name">Nombre completo</label>
                <input
                  id="register-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nombre y apellido"
                  autoComplete="name"
                />
              </div>

              <div className="login-field">
                <label htmlFor="register-email">Correo corporativo</label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="usuario@empresa.com"
                  autoComplete="email"
                />
              </div>

              <div className="login-field">
                <label htmlFor="register-company">Empresa</label>
                <input
                  id="register-company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Nombre de la empresa"
                  autoComplete="organization"
                />
              </div>

              <div className="login-field">
                <label htmlFor="register-role">Cargo o rol</label>
                <input
                  id="register-role"
                  name="role"
                  type="text"
                  value={formData.role}
                  onChange={handleChange}
                  placeholder="Ej: Analista documental"
                />
              </div>

              <div className="login-field">
                <label htmlFor="register-reason">Motivo de acceso</label>
                <textarea
                  id="register-reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="Describe brevemente para qué necesitas usar la plataforma"
                  rows="4"
                />
              </div>

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <button className="login-submit" type="submit">
                Enviar solicitud
              </button>

              <button
                type="button"
                className="login-link-button login-create-account"
                onClick={() => navigate('/login')}
              >
                Ya tengo cuenta
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default RegisterPage;
