import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAccessRequests, fetchShipments } from '../services/api.js';

// Panel de inicio para usuarios administradores.
// Resume actividad, solicitudes pendientes y accesos rapidos de gestion.
function AdminHomePage() {
  const [shipments, setShipments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    // Carga datos del historico EDI y solicitudes para mostrar metricas.
    async function loadData() {
      try {
        const [shipmentsData, requestsData] = await Promise.all([
          fetchShipments(),
          fetchAccessRequests(),
        ]);

        setShipments(Array.isArray(shipmentsData) ? shipmentsData : []);
        setRequests(Array.isArray(requestsData) ? requestsData : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const editedCount = shipments.filter((shipment) => shipment.isEdited).length;
  const multipleCount = shipments.filter((shipment) => shipment.isMultipleMessages).length;
  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const pendingCreateAccounts = pendingRequests.filter(
    (request) => request.type === 'create-account'
  ).length;
  const pendingRecoverAccess = pendingRequests.filter(
    (request) => request.type === 'recover-access'
  ).length;
  const hasPendingRequests = pendingRequests.length > 0;
  const recentShipments = shipments.slice(0, 5);

  function handleLogout() {
    localStorage.removeItem('shiptranslateSession');
    window.dispatchEvent(new Event('shiptranslate-session-change'));
    navigate('/login');
  }

  return (
    <section className="admin-home-page">
      <div className="home-background-gradient" />

      <div className="admin-home-container">
        <div className="admin-home-hero">
          <div>
            <div className="hero-badge">
              <span className="badge-dot" />
              Panel administrador
            </div>

            <h1 className="hero-title">
              Control operacional de{' '}
              <span className="hero-title-accent">
                ShipTranslate
              </span>
            </h1>

            <p className="hero-description">
              Supervisa documentos procesados, solicitudes de acceso y actividad
              documental desde una vista pensada para administracion.
            </p>
          </div>
        </div>

        <div className="admin-metrics-grid">
          <div className="admin-metric-card">
            <span>Total EDI</span>
            <strong>{loading ? '...' : shipments.length}</strong>
            <small>Registros en historico</small>
          </div>

          <div className="admin-metric-card">
            <span>EDI editados</span>
            <strong>{loading ? '...' : editedCount}</strong>
            <small>Documentos modificados</small>
          </div>

          <div className="admin-metric-card">
            <span>Multiples BL</span>
            <strong>{loading ? '...' : multipleCount}</strong>
            <small>Intercambios consolidados</small>
          </div>

          <div
            className={`admin-metric-card ${
              hasPendingRequests ? 'attention' : 'all-clear'
            }`}
          >
            <span>Solicitudes</span>
            <strong>
              {loading ? '...' : hasPendingRequests ? 'Revision' : 'Al dia'}
            </strong>
            <small>Cuentas y accesos pendientes</small>
          </div>
        </div>

        <div className="admin-workspace-grid">
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>Acciones rapidas</h2>
                <p>Operaciones frecuentes para administrar la plataforma.</p>
              </div>
            </div>

            <div className="admin-actions-grid">
              <Link className="admin-action-card" to="/shipments">
                <strong>Revisar historico</strong>
                <span>Audita EDI cargados y generados.</span>
              </Link>

              <Link className="admin-action-card" to="/admin/requests">
                <strong>Solicitudes</strong>
                <span>Revisa cuentas nuevas y recuperaciones.</span>
              </Link>

              <button
                className="admin-action-card admin-action-button"
                type="button"
                onClick={handleLogout}
              >
                <strong>Cerrar sesion</strong>
                <span>Vuelve al acceso de usuarios.</span>
              </button>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <h2>Solicitudes por revisar</h2>
                <p>Cuentas nuevas y recuperacion de acceso requieren aprobacion.</p>
              </div>
            </div>

            <div className="admin-review-list">
              <div className="admin-review-item">
                <span>Crear cuenta</span>
                <strong>
                  {loading ? '...' : `${pendingCreateAccounts} pendientes`}
                </strong>
              </div>

              <div className="admin-review-item">
                <span>Recuperar acceso</span>
                <strong>
                  {loading ? '...' : `${pendingRecoverAccess} pendientes`}
                </strong>
              </div>

              <div className="admin-review-note">
                Las solicitudes quedan sujetas a validacion de empresa, cargo y
                necesidad operacional antes de habilitar el acceso.
              </div>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Actividad reciente</h2>
              <p>Ultimos documentos registrados en el historico.</p>
            </div>

            <Link className="btn-secondary-hero" to="/shipments">
              Ver todo
            </Link>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-activity-table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Emisor</th>
                  <th>Receptor</th>
                  <th>Editado</th>
                  <th>Fecha</th>
                </tr>
              </thead>

              <tbody>
                {recentShipments.length === 0 ? (
                  <tr>
                    <td colSpan="5">No hay actividad registrada todavia.</td>
                  </tr>
                ) : (
                  recentShipments.map((shipment) => (
                    <tr key={shipment._id}>
                      <td>{shipment.sourceFileName || '-'}</td>
                      <td>{shipment.interchange?.sender || '-'}</td>
                      <td>{shipment.interchange?.receiver || '-'}</td>
                      <td>{shipment.isEdited ? 'Si' : 'No'}</td>
                      <td>
                        {shipment.createdAt
                          ? new Date(shipment.createdAt).toLocaleDateString('es-CL')
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AdminHomePage;
