import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteShipment, fetchShipments } from '../services/api.js';

// Lee la sesion para saber si el usuario puede ver acciones administrativas.
function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem('shiptranslateSession')) || null;
  } catch {
    return null;
  }
}

// Historico de EDIs procesados.
// Permite revisar registros, generar EDI nuevamente y eliminar si el rol es admin.
function ShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === 'admin';

  useEffect(() => {
    loadShipments();
  }, []);

  async function loadShipments() {
    // Carga desde MongoDB todos los shipments guardados.
    setLoading(true);

    try {
      const data = await fetchShipments();
      setShipments(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los envíos.');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date) {
    if (!date) return '-';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return '-';

    return parsedDate.toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getInterchange(shipment) {
    return shipment?.interchange || shipment?.ediPayload?.interchange || {};
  }

  function getMessages(shipment) {
    if (Array.isArray(shipment?.ediMessages)) {
      return shipment.ediMessages;
    }

    if (Array.isArray(shipment?.ediPayload?.ediMessages)) {
      return shipment.ediPayload.ediMessages;
    }

    return [];
  }

  function handleGenerateEdi(shipment) {
    // Reutiliza un EDI guardado y lo manda a la pantalla de generacion.
    const messages = getMessages(shipment);

    navigate('/convert-edi', {
      state: {
        parsedData: messages,
        ediPayload: shipment,
        shipment,
      },
    });
  }

  async function handleDeleteShipment(shipment) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `¿Eliminar el EDI ${shipment.interchange?.interchangeId || shipment._id}?`
    );

    if (!confirmed) return;

    try {
      await deleteShipment(shipment._id);
      setShipments((current) =>
        current.filter((item) => item._id !== shipment._id)
      );
    } catch (err) {
      console.error(err);
      setError('No se pudo eliminar el EDI.');
    }
  }

  return (
    <section className="shipments-page">

      <div className="home-background-gradient" />

      <div className="shipments-container">

        <div className="shipments-header">

          <div>
            <div className="hero-badge">
              <span className="badge-dot" />
              Historial documental
            </div>

            <h1>
              Lista de envíos EDI
            </h1>

            <p>
              Consulta los intercambios procesados, revisa su estado y genera
              nuevamente el archivo EDI cuando lo necesites.
            </p>
          </div>

          <button
            className="btn-secondary-hero"
            onClick={loadShipments}
          >
            Actualizar
          </button>

        </div>

        {loading && (
          <div className="shipments-status-card">
            Cargando envíos...
          </div>
        )}

        {error && (
          <div className="shipments-error-card">
            {error}
          </div>
        )}

        {!loading && !error && shipments.length === 0 && (
          <div className="shipments-empty-card">
            No hay envíos registrados todavía.
          </div>
        )}

        {!loading && !error && shipments.length > 0 && (

          <div className="shipments-table-card">

            <table className="shipments-table">

              <thead>
                <tr>
                  <th>Emisor</th>
                  <th>Receptor</th>
                  {isAdmin && <th>Usuario</th>}
                  <th>Estado</th>
                  <th>Editado</th>
                  <th>Fecha</th>
                  <th>ID Interchange</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {shipments.map((shipment) => {
                  const interchange = getInterchange(shipment);

                  return (
                    <tr key={shipment._id}>

                      <td>
                        <div className="table-main-info">
                          {interchange.sender || shipment.sender || '-'}
                        </div>
                      </td>

                      <td>
                        <div className="table-secondary-info">
                          {interchange.receiver || shipment.receiver || '-'}
                        </div>
                      </td>

                      {isAdmin && (
                        <td>
                          <div className="table-main-info">
                            {shipment.processedBy?.name ||
                              shipment.processedBy?.email ||
                              '-'}
                          </div>

                          {shipment.processedBy?.email && (
                            <div className="table-sub-info">
                              {shipment.processedBy.email}
                            </div>
                          )}
                        </td>
                      )}

                      <td>
                        <span className="status-badge success">
                          {shipment.status || 'Registrado'}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`edited-badge ${
                            shipment.isEdited ? 'edited' : 'original'
                          }`}
                        >
                          {shipment.isEdited ? 'Sí' : 'No'}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          shipment.createdAt ||
                          shipment.date ||
                          interchange.interchangeDate
                        )}
                      </td>

                      <td>
                        <div className="interchange-id">
                          {interchange.interchangeId || shipment.interchangeId || '-'}
                        </div>
                      </td>

                      <td>
                        <div className="shipment-admin-actions">
                          <button
                            className="generate-edi-button"
                            onClick={() => handleGenerateEdi(shipment)}
                          >
                            Generar EDI
                          </button>

                          {isAdmin && (
                            <button
                              className="delete-edi-button"
                              onClick={() => handleDeleteShipment(shipment)}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>

          </div>

        )}

      </div>

    </section>
  );
}

export default ShipmentsPage;
