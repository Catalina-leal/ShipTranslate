import ConvertToEdiPage from './pages/ConvertToEdiPage.jsx';
import {
  useEffect,
  useState,
} from 'react';

import {
  BrowserRouter,
  Navigate,
  Link,
  useNavigate,
  Route,
  Routes,
} from 'react-router-dom';

import Home from './pages/Home.jsx';
import ShipmentsPage from './pages/ShipmentsPage.jsx';
import NewShipmentPage from './pages/NewShipmentPage.jsx';
import EdiPreviewPage from './pages/EdiPreviewPage.jsx';
import ShipmentDetailsPage from './pages/ShipmentDetailsPage.jsx';
import Tracking from './pages/Tracking.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import RecoverAccessPage from './pages/RecoverAccessPage.jsx';
import AdminHomePage from './pages/AdminHomePage.jsx';
import AdminRequestsPage from './pages/AdminRequestsPage.jsx';

// Revisa si existe una sesion guardada en el navegador.
function isAuthenticated() {
  return Boolean(localStorage.getItem('shiptranslateSession'));
}

// Recupera los datos del usuario logueado, incluido su rol.
function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem('shiptranslateSession')) || null;
  } catch {
    return null;
  }
}

// Protege rutas que requieren cualquier usuario autenticado.
function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Protege rutas segun rol, por ejemplo solo admin para solicitudes.
function RoleProtectedRoute({ children, allowedRoles }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = getSessionUser();

  if (allowedRoles?.length && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Decide que inicio mostrar: panel admin o inicio operacional.
function HomeByRole() {
  const user = getSessionUser();

  if (user?.role === 'admin') {
    return <AdminHomePage />;
  }

  return <Home />;
}

// Navegacion superior. Cambia sus links segun no logueado, user o admin.
function AppNav() {
  const [user, setUser] = useState(getSessionUser());
  const navigate = useNavigate();

  useEffect(() => {
    // Mantiene sincronizado el menu si la sesion cambia en login/logout.
    function handleSessionChange() {
      setUser(getSessionUser());
    }

    window.addEventListener('shiptranslate-session-change', handleSessionChange);
    window.addEventListener('storage', handleSessionChange);

    return () => {
      window.removeEventListener('shiptranslate-session-change', handleSessionChange);
      window.removeEventListener('storage', handleSessionChange);
    };
  }, []);

  function handleLogout(event) {
    // Cierra sesion limpiando localStorage y redirigiendo al login.
    event.preventDefault();
    localStorage.removeItem('shiptranslateSession');
    setUser(null);
    window.dispatchEvent(new Event('shiptranslate-session-change'));
    navigate('/login');
  }

  const userLinks = [
    { to: '/', label: 'Inicio' },
    { to: '/shipments', label: 'Histórico' },
    { to: '/shipments/new', label: 'Nuevo EDI' },
    { to: '/tracking', label: 'PDF' },
    { to: '/login', label: 'Cerrar sesión', onClick: handleLogout },
  ];

  const adminLinks = [
    { to: '/', label: 'Inicio' },
    { to: '/shipments', label: 'Histórico' },
    { to: '/admin/requests', label: 'Solicitudes' },
    { to: '/login', label: 'Cerrar sesión', onClick: handleLogout },
  ];

  const publicLinks = [
    { to: '/login', label: 'Iniciar sesión' },
  ];

  const links = user?.role === 'admin'
    ? adminLinks
    : user
    ? userLinks
    : publicLinks;

  return (
    <nav>
      {links.map((link) => (
        <Link key={link.label} to={link.to} onClick={link.onClick}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function App() {

  return (

    <BrowserRouter>

      <div className="app-container">

        {/* =========================
            HEADER
        ========================= */}

        <header>

          <div className="header-top">

            <div className="header-brand">

              <h1>
                ShipTranslate
              </h1>

              <span className="header-subtitle">
                Plataforma EDI Marítima
              </span>

            </div>

            <AppNav />

          </div>

        </header>

        {/* =========================
            MAIN
        ========================= */}

        <main>

          <Routes>

            {/* HOME */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomeByRole />
                </ProtectedRoute>
              }
            />

            {/* LOGIN */}
            <Route
              path="/login"
              element={<LoginPage />}
            />

            {/* REGISTRO */}
            <Route
              path="/register"
              element={<RegisterPage />}
            />

            {/* RECUPERAR ACCESO */}
            <Route
              path="/recover-access"
              element={<RecoverAccessPage />}
            />

            {/* SOLICITUDES ADMIN */}
            <Route
              path="/admin/requests"
              element={
                <RoleProtectedRoute allowedRoles={['admin']}>
                  <AdminRequestsPage />
                </RoleProtectedRoute>
              }
            />

            {/* LISTA */}
            <Route
              path="/shipments"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <ShipmentsPage />
                </RoleProtectedRoute>
              }
            />

            {/* NUEVO EDI */}
            <Route
              path="/shipments/new"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <NewShipmentPage />
                </RoleProtectedRoute>
              }
            />

            {/* PREVIEW */}
            <Route
              path="/edi-preview"
              element={
                <ProtectedRoute>
                  <EdiPreviewPage />
                </ProtectedRoute>
              }
            />

            {/* DETALLES GUARDADOS */}
            <Route
              path="/shipments/:id"
              element={
                <ProtectedRoute>
                  <ShipmentDetailsPage />
                </ProtectedRoute>
              }
            />

            {/* DETALLES PREVIEW */}
            <Route
              path="/shipments/preview"
              element={
                <ProtectedRoute>
                  <ShipmentDetailsPage />
                </ProtectedRoute>
              }
            />

            {/* TRACKING PDF */}
            <Route
              path="/tracking"
              element={
                <RoleProtectedRoute allowedRoles={['admin', 'user']}>
                  <Tracking />
                </RoleProtectedRoute>
              }
            />

            {/* CONVERTIR A EDI */}
            <Route
              path="/convert-edi"
              element={
                <ProtectedRoute>
                  <ConvertToEdiPage />
                </ProtectedRoute>
              }
            />

            {/* REDIRECT */}
            <Route
              path="*"
              element={<Navigate to="/" replace />}
            />

          </Routes>

        </main>

      </div>

    </BrowserRouter>
  );
}

export default App;
