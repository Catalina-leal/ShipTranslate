import { useEffect, useState } from 'react';
import { fetchAccessRequests, updateAccessRequest } from '../services/api.js';

// Traduce estados internos de MongoDB a etiquetas legibles para la interfaz.
function getStatusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    finalized: 'Finalizada',
  };

  return labels[status] || status;
}

// Tarjeta reutilizable para mostrar solicitudes de crear cuenta o recuperar acceso.
function RequestCard({
  request,
  onStatusChange,
  showDecisionActions,
  showRecoveryActions,
}) {
  return (
    <div className="admin-request-card">
      <div className="admin-request-top">
        <div>
          <strong>{request.name || request.email}</strong>
          <span>{request.email}</span>
        </div>

        <span className="admin-request-status">
          {getStatusLabel(request.status)}
        </span>
      </div>

      <div className="admin-request-grid">
        {request.company && (
          <div>
            <span>Empresa</span>
            <strong>{request.company}</strong>
          </div>
        )}

        {request.role && (
          <div>
            <span>Rol</span>
            <strong>{request.role}</strong>
          </div>
        )}

        {request.reason && (
          <div>
            <span>Razón</span>
            <strong>{request.reason}</strong>
          </div>
        )}

        <div>
          <span>Fecha</span>
          <strong>
            {request.createdAt
              ? new Date(request.createdAt).toLocaleDateString('es-CL')
              : '-'}
          </strong>
        </div>
      </div>

      {request.details && (
        <p className="admin-request-details">
          {request.details}
        </p>
      )}

      {showDecisionActions && request.status === 'pending' && (
        <div className="admin-request-actions">
          <button
            type="button"
            className="admin-approve-button"
            onClick={() => onStatusChange(request._id, 'approved')}
          >
            Aprobar
          </button>

          <button
            type="button"
            className="admin-reject-button"
            onClick={() => onStatusChange(request._id, 'rejected')}
          >
            Rechazar
          </button>
        </div>
      )}

      {showRecoveryActions && request.status === 'pending' && (
        <div className="admin-request-actions">
          <button
            type="button"
            className="admin-approve-button"
            onClick={() => onStatusChange(request._id, 'finalized')}
          >
            Finalizado
          </button>

          <button
            type="button"
            className="admin-reject-button"
            onClick={() => onStatusChange(request._id, 'rejected')}
          >
            Rechazado
          </button>
        </div>
      )}
    </div>
  );
}

function RequestSection({
  title,
  description,
  requests,
  onStatusChange,
  showDecisionActions,
  showRecoveryActions,
}) {
  return (
    <div className="admin-requests-section">
      <div className="admin-panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <span className="summary-badge">
          {requests.length}
        </span>
      </div>

      <div className="admin-requests-list">
        {requests.length === 0 ? (
          <div className="admin-requests-empty">
            No hay solicitudes pendientes en esta área.
          </div>
        ) : (
          requests.map((request) => (
            <RequestCard
              key={request._id}
              request={request}
              onStatusChange={onStatusChange}
              showDecisionActions={showDecisionActions}
              showRecoveryActions={showRecoveryActions}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Vista administrativa donde el admin revisa, aprueba, rechaza o finaliza solicitudes.
function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setError('');

    try {
      const data = await fetchAccessRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (requestError) {
      console.error(requestError);
      setError('No se pudieron cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id, status) {
    try {
      const updatedRequest = await updateAccessRequest(id, { status });

      setRequests((current) =>
        current.map((request) =>
          request._id === id ? updatedRequest : request
        )
      );
    } catch (requestError) {
      console.error(requestError);
      setError('No se pudo actualizar la solicitud.');
    }
  }

  const createAccountRequests = requests.filter(
    (request) => request.type === 'create-account'
  );
  const recoverAccessRequests = requests.filter(
    (request) => request.type === 'recover-access'
  );

  return (
    <section className="admin-home-page">
      <div className="home-background-gradient" />

      <div className="admin-home-container">
        <div className="admin-home-hero">
          <div>
            <div className="hero-badge">
              <span className="badge-dot" />
              Solicitudes administrativas
            </div>

            <h1 className="hero-title">
              Revisión de{' '}
              <span className="hero-title-accent">
                accesos
              </span>
            </h1>

            <p className="hero-description">
              Revisa en un solo lugar las solicitudes de creación de cuenta y
              recuperación de acceso enviadas por los usuarios.
            </p>
          </div>

          <button
            className="btn-secondary-hero"
            onClick={loadRequests}
            disabled={loading}
          >
            Actualizar
          </button>
        </div>

        {error && (
          <div className="shipments-error-card">
            {error}
          </div>
        )}

        <div className="admin-requests-grid">
          <RequestSection
            title="Crear cuenta"
            description="Solicitudes de nuevos usuarios que requieren aprobación del administrador."
            requests={createAccountRequests}
            onStatusChange={handleStatusChange}
            showDecisionActions
          />

          <RequestSection
            title="Recuperar acceso"
            description="Casos enviados por usuarios que necesitan validación o restablecimiento."
            requests={recoverAccessRequests}
            onStatusChange={handleStatusChange}
            showRecoveryActions
          />
        </div>
      </div>
    </section>
  );
}

export default AdminRequestsPage;
