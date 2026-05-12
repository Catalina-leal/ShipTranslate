import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadEdiFile } from '../services/api.js';

function EdiPreviewPage() {
  const [parsedData, setParsedData] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [vesselDiscrepancy, setVesselDiscrepancy] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [availableVessels, setAvailableVessels] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { parsedData: data, file } = location.state || {};
    if (!data || !file) {
      navigate('/shipments/new');
      return;
    }

    setParsedData(data);
    setEditedData(JSON.parse(JSON.stringify(data))); // Deep copy for editing
    setLoading(false);
  }, [location.state, navigate]);

  // Función para detectar discrepancias en buques y calcular buques disponibles
  useEffect(() => {
    if (editedData && Array.isArray(editedData)) {
      const vessels = editedData
        .map(message => message.transport?.vessel)
        .filter(vessel => vessel && vessel.trim() !== '');

      // Calcular buques únicos disponibles
      const uniqueVessels = [...new Set(vessels)].sort();
      setAvailableVessels(uniqueVessels);

      if (vessels.length > 1) {
        const uniqueVesselsSet = new Set(vessels);
        if (uniqueVesselsSet.size > 1) {
          setVesselDiscrepancy({
            vessels: Array.from(uniqueVesselsSet),
            count: vessels.length,
            uniqueCount: uniqueVesselsSet.size
          });
        } else {
          setVesselDiscrepancy(null);
        }
      } else {
        setVesselDiscrepancy(null);
      }
    }
  }, [editedData]);

  // Funciones para selección múltiple
  function handleSelectAll() {
    if (selectedRows.length === editedData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(editedData.map((_, index) => index));
    }
  }

  function handleSelectRow(index) {
    setSelectedRows(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  }

  // Función para edición masiva
  function handleBulkEdit(field, value) {
    if (selectedRows.length === 0) return;

    const newData = JSON.parse(JSON.stringify(editedData));
    selectedRows.forEach(rowIndex => {
      if (field === 'vessel') {
        if (!newData[rowIndex].transport) newData[rowIndex].transport = {};
        newData[rowIndex].transport.vessel = value;
      } else if (field === 'carrier') {
        if (!newData[rowIndex].transport) newData[rowIndex].transport = {};
        newData[rowIndex].transport.carrier = value;
      } else if (field === 'origin') {
        newData[rowIndex].origin = value;
      } else if (field === 'destination') {
        newData[rowIndex].destination = value;
      } else if (field === 'client') {
        newData[rowIndex].client = value;
      }
    });
    setEditedData(newData);
  }

  function handleFieldChange(messageIndex, field, value) {
    const newData = JSON.parse(JSON.stringify(editedData));
    if (Array.isArray(newData)) {
      newData[messageIndex][field] = value;
    } else {
      newData[field] = value;
    }
    setEditedData(newData);
  }

  function handleNestedFieldChange(messageIndex, parentField, childField, value) {
    const newData = JSON.parse(JSON.stringify(editedData));
    if (Array.isArray(newData)) {
      if (!newData[messageIndex][parentField]) {
        newData[messageIndex][parentField] = {};
      }
      newData[messageIndex][parentField][childField] = value;
    } else {
      if (!newData[parentField]) {
        newData[parentField] = {};
      }
      newData[parentField][childField] = value;
    }
    setEditedData(newData);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Usar los datos editados en lugar de los datos originales
      const dataToSave = editedData || parsedData;
      const uploadedShipment = await uploadEdiFile(location.state.file, dataToSave);
      navigate(`/shipments/${uploadedShipment._id}`);
    } catch (err) {
      setError('Error al guardar el envío');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate('/shipments/new');
  }

  if (loading) {
    return (
      <section className="page-card">
        <h2>Procesando archivo EDI</h2>
        <p>Analizando el contenido del archivo...</p>
      </section>
    );
  }

  if (error || !parsedData) {
    return (
      <section className="page-card">
        <h2>Error al procesar EDI</h2>
        <p className="error">{error || 'No se pudo procesar el archivo'}</p>
        <button onClick={() => navigate('/shipments/new')}>Volver</button>
      </section>
    );
  }

  return (
    <section className="page-card">
      <h2>Previsualización del EDI</h2>
      <p>Revisa la información extraída del archivo EDI antes de guardarla:</p>

      {vesselDiscrepancy && (
        <div className="alert alert-warning">
          <h3>Discrepancia en Buques Detectada</h3>
          
          <ul>
            {vesselDiscrepancy.vessels.map((vessel, index) => (
              <li key={index}><strong>{vessel}</strong></li>
            ))}
          </ul>
          <p>Por favor, verifica que todos los Bls correspondan a la misma nave antes de guardar.</p>
        </div>
      )}

      {Array.isArray(editedData) && editedData.length > 1 ? (
        // Vista de tabla para múltiples mensajes EDI
        <div className="edi-messages-table">
          <h3>Cantidad de Bls: {editedData.length}</h3>
          <div className="table-container">
            <table className="edi-table">
              <thead>
                <tr>
                  <th>N° BL</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Peso total (kg)</th>
                  <th>Fecha Emisión</th>
                  <th>ETA</th>
                  <th>ETD</th>
                  <th>Loyd</th>
                  <th>Buque</th>
                  <th>Viaje</th>
                  <th>Descripción</th>
                  <th>Paquetes</th>
                  <th>Contenedores</th>
                  <th>Nombre archivo</th>
                </tr>
              </thead>
              <tbody>
                {editedData.map((message, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        value={message.referenceNumber || message.documentNumber || ''}
                        onChange={(e) => handleFieldChange(index, 'referenceNumber', e.target.value)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={message.origin || ''}
                        onChange={(e) => handleFieldChange(index, 'origin', e.target.value)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={message.destination || ''}
                        onChange={(e) => handleFieldChange(index, 'destination', e.target.value)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={message.weight || 0}
                        onChange={(e) => handleFieldChange(index, 'weight', parseFloat(e.target.value) || 0)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={message.dates?.documentDate ? new Date(message.dates.documentDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleNestedFieldChange(index, 'dates', 'documentDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={message.dates?.eta ? new Date(message.dates.eta).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleNestedFieldChange(index, 'dates', 'eta', e.target.value ? new Date(e.target.value).toISOString() : null)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={message.dates?.etd ? new Date(message.dates.etd).toISOString().split('T')[0] : ''}
                        onChange={(e) => handleNestedFieldChange(index, 'dates', 'etd', e.target.value ? new Date(e.target.value).toISOString() : null)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={message.transport?.loyd || ''}
                        onChange={(e) => handleNestedFieldChange(index, 'transport', 'loyd', e.target.value)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={message.transport?.vessel || ''}
                        onChange={(e) => handleNestedFieldChange(index, 'transport', 'vessel', e.target.value)}
                        className={`table-input ${vesselDiscrepancy ? 'input-warning' : ''}`}
                      />
                    </td>

                      <td>
                      <input
                        type="text"
                        value={message.transport?.voyage || ''}
                        onChange={(e) => handleNestedFieldChange(index, 'transport', 'voyage', e.target.value)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={message.goods?.description || ''}
                        onChange={(e) => handleNestedFieldChange(index, 'goods', 'description', e.target.value)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={message.goods?.packages || 0}
                        onChange={(e) => handleNestedFieldChange(index, 'goods', 'packages', parseInt(e.target.value) || 0)}
                        className="table-input"
                      />
                    </td>
                    <td>
                      {message.containers && message.containers.length > 0
                        ? message.containers.map(c => `${c.number} (${c.type})`).join(', ')
                        : '-'
                      }
                    </td>
                     <td>
                      <input
                        type="text"
                        value={message.client || ''}
                        onChange={(e) => handleFieldChange(index, 'client', e.target.value)}
                        className="table-input"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Vista tradicional para un solo mensaje EDI
        <div className="edi-preview">
          {(() => {
            const data = Array.isArray(parsedData) ? parsedData[0] : parsedData;
            return (
              <>
                <div className="preview-section">
                  <h3>Información General</h3>
                  <div className="preview-grid">
                    <div className="preview-item">
                      <strong>N° BL</strong> {data.referenceNumber || data.documentNumber}
                    </div>
                    <div className="preview-item">
                      <strong>Origen:</strong> {data.origin}
                    </div>
                    <div className="preview-item">
                      <strong>Destino:</strong> {data.destination}
                    </div>
                    <div className="preview-item">
                      <strong>Nombre doc.</strong> {data.client}
                    </div>
                    <div className="preview-item">
                      <strong>Peso total  (kg):</strong> {data.weight}
                    </div>
                    <div className="preview-item">
                      <strong>Moneda:</strong> {data.currency}
                    </div>
                  </div>
                </div>

                {data.dates && Object.keys(data.dates).length > 0 && (
                  <div className="preview-section">
                    <h3>Fechas</h3>
                    <div className="preview-grid">
                      {data.dates.documentDate && (
                        <div className="preview-item">
                          <strong>Fecha Documento:</strong> {new Date(data.dates.documentDate).toLocaleDateString()}
                        </div>
                      )}
                      {data.dates.eta && (
                        <div className="preview-item">
                          <strong>ETA:</strong> {new Date(data.dates.eta).toLocaleDateString()}
                        </div>
                      )}
                      {data.dates.etd && (
                        <div className="preview-item">
                          <strong>ETD:</strong> {new Date(data.dates.etd).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {data.containers && data.containers.length > 0 && (
                  <div className="preview-section">
                    <h3>Contenedores</h3>
                    {data.containers.map((container, index) => (
                      <div key={index} className="container-preview">
                        <div className="preview-grid">
                          <div className="preview-item">
                            <strong>Número:</strong> {container.number}
                          </div>
                          <div className="preview-item">
                            <strong>Tipo:</strong> {container.type}
                          </div>
                          <div className="preview-item">
                            <strong>Cantidad de bultos</strong> {container.quantity}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {data.transport && Object.keys(data.transport).length > 0 && (
                  <div className="preview-section">
                    <h3>Transporte</h3>
                    <div className="preview-grid">
                      {data.transport.voyage && (
                        <div className="preview-item">
                          <strong>Viaje:</strong> {data.transport.voyage}
                        </div>
                      )}
                      {data.transport.vessel && (
                        <div className="preview-item">
                          <strong>Buque:</strong> {data.transport.vessel}
                        </div>
                      )}
                      {data.transport.carrier && (
                        <div className="preview-item">
                          <strong>Transportista:</strong> {data.transport.carrier}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {data.goods && Object.keys(data.goods).length > 0 && (
                  <div className="preview-section">
                    <h3>Mercancía</h3>
                    <div className="preview-grid">
                      {data.goods.description && (
                        <div className="preview-item">
                          <strong>Descripción:</strong> {data.goods.description}
                        </div>
                      )}
                      {data.goods.packages && (
                        <div className="preview-item">
                          <strong>Paquetes:</strong> {data.goods.packages}
                        </div>
                      )}
                      {data.goods.packageType && (
                        <div className="preview-item">
                          <strong>Tipo:</strong> {data.goods.packageType}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {data.amounts && data.amounts.length > 0 && (
                  <div className="preview-section">
                    <h3>Montos</h3>
                    {data.amounts.map((amount, index) => (
                      <div key={index} className="amount-preview">
                        <div className="preview-grid">
                          <div className="preview-item">
                            <strong>Tipo:</strong> {amount.type}
                          </div>
                          <div className="preview-item">
                            <strong>Valor:</strong> {amount.value} {data.currency}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      <div className="preview-actions">
        <button onClick={handleCancel} disabled={saving}>
          Cancelar
        </button>
        <button onClick={handleSave} disabled={saving} className="button-primary">
          {saving ? 'Guardando...' : 'Guardar Envío'}
        </button>
      </div>
    </section>
  );
}

export default EdiPreviewPage;