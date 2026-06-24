import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/api.js';

// Pantalla de inicio de sesion.
// Valida credenciales contra el backend y guarda la sesion local con rol.
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(event) {
    // Envia correo/contrasena a /api/auth/login y conserva usuario + rol.
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError('Ingresa correo y contraseña para continuar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await loginUser({
        email: email.trim(),
        password,
      });

      localStorage.setItem(
        'shiptranslateSession',
        JSON.stringify({
          ...response.user,
          remember,
          loggedAt: new Date().toISOString(),
        })
      );
      window.dispatchEvent(new Event('shiptranslate-session-change'));

      navigate('/');
    } catch (loginError) {
      setError(
        loginError.response?.data?.message ||
          'No se pudo iniciar sesión.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCreateAccount() {
    navigate('/register');
  }

  function handleRecoverAccess() {
    navigate('/recover-access');
  }

  return (
    <section className="login-page">
      <div className="login-background-gradient" />

      <div className="login-layout">
        <div className="login-copy">
          <div className="hero-badge">
            <span className="badge-dot" />
            Acceso seguro
          </div>

          <h1 className="hero-title">
            Ingresa a{' '}
            <span className="hero-title-accent">
              ShipTranslate
            </span>
          </h1>

          <p className="hero-description">
            Accede a la plataforma para gestionar EDI marítimos, revisar
            documentos PDF y mantener trazabilidad documental desde un solo lugar.
          </p>

          <div className="login-signal-grid">
            <div className="login-signal">
              <strong>EDI</strong>
              <span>Histórico y generación documental</span>
            </div>

            <div className="login-signal">
              <strong>PDF</strong>
              <span>Extracción inteligente de BLs</span>
            </div>

            <div className="login-signal">
              <strong>Tracking</strong>
              <span>Trazabilidad operativa centralizada</span>
            </div>
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
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>

            <div>
              <h2>Iniciar sesión</h2>
              <p>Ingresa tus credenciales para continuar.</p>
            </div>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="login-email">Correo</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@empresa.com"
                autoComplete="email"
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <div className="login-options">
              <label className="login-check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>Recordar sesión</span>
              </label>

              <button
                type="button"
                className="login-link-button"
                onClick={handleRecoverAccess}
              >
                Recuperar acceso
              </button>
            </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Entrar'}
            </button>

            <button
              type="button"
              className="login-link-button login-create-account"
              onClick={handleCreateAccount}
            >
              Crear cuenta
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
