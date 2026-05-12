import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchShipment } from '../services/api.js';

function ShipmentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadShipment();
  }, [id]);

  async function loadShipment() {
    setLoading(true);
    try {
      const data = await fetchShipment(id);
      setShipment(data);
      setError(null);
    } catch (err) {
      setError('No se pudo cargar el envío.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="page-card">
        <h2>Detalles del envío</h2>
        <p>Cargando...</p>
      </section>
    );
  }

  if (error || !shipment) {
    return (
      <section className="page-card">
        <h2>Detalles del envío</h2>
        <p className="error">{error || 'Envío no encontrado'}</p>
        <button onClick={() => navigate('/shipments')}>Volver a la lista</button>
      </section>
    );
  }

  return (
    <section className="page-card">
      <h2>Detalles del envío</h2>

      {shipment.isMultipleMessages ? (
        // Vista de tabla para múltiples mensajes EDI
        <div className="edi-messages-table">
          <h3>Mensajes EDI ({shipment.ediMessages?.length || 0})</h3>
          <div className="table-container">
            <table className="edi-table">
              <thead>
                <tr>
                  <th>N° BL</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Nombre doc.</th>
                  <th>Peso (kg)</th>
                  <th>Estado</th>
                  <th>Fecha Documento</th>
                  <th>ETA</th>
                  <th>ETD</th>
                  <th>Viaje</th>
                  <th>Loyd</th>
                  <th>Buque</th>
                  <th>Transportista</th>
                  <th>Descripción</th>
                  <th>Paquetes</th>
                  <th>Contenedores</th>
                </tr>
              </thead>
              <tbody>
                {shipment.ediMessages?.map((message, index) => (
                  <tr key={index}>
                    <td>{message.referenceNumber || message.documentNumber || '-'}</td>
                    <td>{message.origin || '-'}</td>
                    <td>{message.destination || '-'}</td>
                    <td>{message.client || '-'}</td>
                    <td>{message.weight || 0}</td>
                    <td>{message.status || '-'}</td>
                    <td>{message.dates?.documentDate ? new Date(message.dates.documentDate).toLocaleDateString() : '-'}</td>
                    <td>{message.dates?.eta ? new Date(message.dates.eta).toLocaleDateString() : '-'}</td>
                    <td>{message.dates?.etd ? new Date(message.dates.etd).toLocaleDateString() : '-'}</td>
                    <td>{message.transport?.voyage || '-'}</td>
                    <td>{message.transport?.loyd || '-'}</td>
                    <td>{message.transport?.vessel || '-'}</td>
                    <td>{message.transport?.carrier || '-'}</td>
                    <td>{message.goods?.description || '-'}</td>
                    <td>{message.goods?.packages || '-'}</td>
                    <td>
                      {message.containers && message.containers.length > 0
                        ? message.containers.map(c => `${c.number} (${c.type})`).join(', ')
                        : '-'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Vista tradicional para envío único
        <div className="shipment-details">
          <div className="detail-section">
            <h3>Información General</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>Número de Documento:</strong> {shipment.documentNumber}
              </div>
              <div className="detail-item">
                <strong>Origen:</strong> {shipment.origin}
              </div>
              <div className="detail-item">
                <strong>Destino:</strong> {shipment.destination}
              </div>
              <div className="detail-item">
                <strong>Cliente:</strong> {shipment.client}
              </div>
              <div className="detail-item">
                <strong>Peso (kg):</strong> {shipment.weight}
              </div>
              <div className="detail-item">
                <strong>Estado:</strong> {shipment.status}
              </div>
              <div className="detail-item">
                <strong>Moneda:</strong> {shipment.currency}
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Fechas</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>Fecha Documento:</strong> {shipment.dates?.documentDate ? new Date(shipment.dates.documentDate).toLocaleDateString() : 'No especificada'}
              </div>
              <div className="detail-item">
                <strong>ETA:</strong> {shipment.dates?.eta ? new Date(shipment.dates.eta).toLocaleDateString() : 'No especificada'}
              </div>
              <div className="detail-item">
                <strong>ETD:</strong> {shipment.dates?.etd ? new Date(shipment.dates.etd).toLocaleDateString() : 'No especificada'}
              </div>
            </div>
          </div>

          {shipment.containers && shipment.containers.length > 0 && (
            <div className="detail-section">
              <h3>Contenedores</h3>
              <div className="containers-list">
                {shipment.containers.map((container, index) => (
                  <div key={index} className="container-item">
                    <div className="detail-grid">
                      <div className="detail-item">
                        <strong>Número:</strong> {container.number}
                      </div>
                      <div className="detail-item">
                        <strong>Tipo:</strong> {container.type}
                      </div>
                      <div className="detail-item">
                        <strong>Cantidad:</strong> {container.quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3>Transporte</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>Viaje:</strong> {shipment.transport?.voyage || 'No especificado'}
              </div>
              <div className="detail-item">
                <strong>Buque:</strong> {shipment.transport?.vessel || 'No especificado'}
              </div>
              <div className="detail-item">
                <strong>Transportista:</strong> {shipment.transport?.carrier || 'No especificado'}
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Mercancía</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>Descripción:</strong> {shipment.goods?.description || 'No especificada'}
              </div>
              <div className="detail-item">
                <strong>Paquetes:</strong> {shipment.goods?.packages || 'No especificado'}
              </div>
              <div className="detail-item">
                <strong>Tipo de Empaque:</strong> {shipment.goods?.packageType || 'No especificado'}
              </div>
            </div>
          </div>

          {shipment.amounts && shipment.amounts.length > 0 && (
            <div className="detail-section">
              <h3>Montos</h3>
              <div className="amounts-list">
                {shipment.amounts.map((amount, index) => (
                  <div key={index} className="amount-item">
                    <div className="detail-grid">
                      <div className="detail-item">
                        <strong>Tipo:</strong> {amount.type}
                      </div>
                      <div className="detail-item">
                        <strong>Valor:</strong> {amount.value} {shipment.currency}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <h3>Información del Sistema</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <strong>ID:</strong> {shipment._id}
              </div>
              <div className="detail-item">
                <strong>Creado:</strong> {new Date(shipment.createdAt).toLocaleString()}
              </div>
              <div className="detail-item">
                <strong>Actualizado:</strong> {new Date(shipment.updatedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="actions">
        <button onClick={() => navigate('/shipments')}>Volver a la lista</button>
        <button onClick={() => navigate('/shipments/new')}>Cargar otro EDI</button>
      </div>
    </section>
  );
}

export default ShipmentDetailsPage;