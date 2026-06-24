import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAccessRequest } from '../services/api.js';

// Pantalla para pedir recuperacion de acceso.
// Genera una solicitud administrativa sin exponer contrasenas.
function RecoverAccessPage() {
  const [formData, setFormData] = useState({
    email: '',
    reason: '',
    details: '',
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
    // Crea una solicitud tipo recover-access para revision del admin.
    event.preventDefault();

    if (
      !formData.email.trim() ||
      !formData.reason.trim() ||
      !formData.details.trim()
    ) {
      setError('Ingresa correo, razón y detalles para enviar la solicitud.');
      return;
    }

    setError('');

    try {
      await createAccessRequest({
        type: 'recover-access',
        email: formData.email,
        reason: formData.reason,
        details: formData.details,
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
            Recuperación de acceso
          </div>

          <h1 className="hero-title">
            Solicita recuperar tu{' '}
            <span className="hero-title-accent">
              acceso
            </span>
          </h1>

          <p className="hero-description">
            Completa la razón y los detalles del problema para que el
            administrador revise tu caso y pueda restablecer o validar tu
            acceso a la plataforma.
          </p>

          <div className="register-review-box">
            <strong>Envío al administrador</strong>
            <span>
              Esta solicitud no cambia tu cuenta automáticamente. El
              administrador revisará la información enviada y decidirá la
              acción correspondiente.
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
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </div>

            <div>
              <h2>Recuperar acceso</h2>
              <p>Describe el motivo para revisión administrativa.</p>
            </div>
          </div>

          {submitted ? (
            <div className="register-success">
              <strong>Solicitud enviada</strong>
              <p>
                Los detalles fueron enviados para revisión del administrador.
                Recibirás respuesta cuando se evalúe tu caso.
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
                <label htmlFor="recover-email">Correo de la cuenta</label>
                <input
                  id="recover-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="usuario@empresa.com"
                  autoComplete="email"
                />
              </div>

              <div className="login-field">
                <label htmlFor="recover-reason">Razón</label>
                <input
                  id="recover-reason"
                  name="reason"
                  type="text"
                  value={formData.reason}
                  onChange={handleChange}
                  placeholder="Ej: Olvidé mi contraseña"
                />
              </div>

              <div className="login-field">
                <label htmlFor="recover-details">Detalles</label>
                <textarea
                  id="recover-details"
                  name="details"
                  value={formData.details}
                  onChange={handleChange}
                  placeholder="Explica qué ocurrió y cualquier dato útil para validar tu identidad"
                  rows="5"
                />
              </div>

              {error && (
                <div className="login-error">
                  {error}
                </div>
              )}

              <button className="login-submit" type="submit">
                Enviar al administrador
              </button>

              <button
                type="button"
                className="login-link-button login-create-account"
                onClick={() => navigate('/login')}
              >
                Volver al inicio de sesión
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default RecoverAccessPage;
