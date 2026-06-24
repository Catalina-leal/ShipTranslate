import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { updateShipment } from '../services/api.js';

// Vista de revision del EDI parseado.
// Permite validar BLs, detectar discrepancias de buque/Lloyd y enviar datos a generacion EDI.
function EdiPreviewPage() {
  const [editedData, setEditedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [parsedRoot, setParsedRoot] = useState(null);
  const [vesselDiscrepancy, setVesselDiscrepancy] = useState(false);
  const [availableVessels, setAvailableVessels] = useState([]);
  const [hasEdited, setHasEdited] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Recibe desde NewShipmentPage el resultado del parser y lo normaliza a ediMessages[].
    const { parsedData: data, file } = location.state || {};

    if (!data || !file) {
      navigate('/shipments/new');
      return;
    }

    const normalizedData = JSON.parse(JSON.stringify(data));

    const rootData = Array.isArray(normalizedData)
      ? { ediMessages: normalizedData }
      : normalizedData;

    const messages = Array.isArray(rootData.ediMessages)
      ? rootData.ediMessages
      : [];

    setParsedRoot(rootData);
    setEditedData(messages);
    setHasEdited(Boolean(location.state?.isEditedDraft));
    setLoading(false);
  }, [location.state, navigate]);

  useEffect(() => {
    // Busca si dentro de los mensajes existen distintos buques.
    // Si hay mas de uno, muestra una alerta para correccion masiva.
    if (!editedData || editedData.length === 0) return;

    const vesselsMap = new Map();

    editedData.forEach((message) => {
      const vessel =
        message?.transport?.selectedVessel ||
        message?.transport?.vessel ||
        '';

      const lloyd =
        message?.transport?.selectedLloyd ||
        message?.transport?.lloyd ||
        message?.transport?.loyd ||
        '';

      if (vessel) {
        vesselsMap.set(vessel, lloyd);
      }
    });

    const vessels = Array.from(vesselsMap.entries()).map(
      ([vessel, lloyd]) => ({
        vessel,
        lloyd,
      })
    );

    setAvailableVessels(vessels);
    setVesselDiscrepancy(vessels.length > 1);
  }, [editedData]);

  function getLocationObject(message, field) {
    const location = message?.locations?.[field];

    if (!location) {
      return { code: '', name: '', raw: '' };
    }

    if (typeof location === 'string') {
      const parts = location.split(':::');

      return {
        code: parts[0] || '',
        name: parts[1] || parts[0] || '',
        raw: location,
      };
    }

    return {
      code: location.code || '',
      name: location.name || '',
      raw: location.raw || `${location.code || ''}:::${location.name || ''}`,
    };
  }

  function getLocationDescription(locationValue) {
    if (!locationValue) return '-';

    if (typeof locationValue === 'string') {
      const parts = locationValue.split(':::');
      return parts[1] || parts[0] || '-';
    }

    return locationValue.name || locationValue.code || '-';
  }

  function getSelectedTransport(message) {
    // Centraliza la forma de leer buque, viaje, Lloyd y ETA desde cada mensaje.
    return {
      vessel:
        message?.transport?.selectedVessel ||
        message?.transport?.vessel ||
        '-',

      voyage:
        message?.transport?.selectedVoyage ||
        message?.transport?.voyage ||
        '-',

      lloyd:
        message?.transport?.selectedLloyd ||
        message?.transport?.lloyd ||
        message?.transport?.loyd ||
        '-',

      eta:
        message?.transport?.selectedETA ||
        message?.dates?.eta ||
        '',
    };
  }

  function handleFieldChange(index, field, value) {
    const newData = [...editedData];
    newData[index][field] = value;
    setEditedData(newData);
    setHasEdited(true);
  }

  function handleMassiveVesselChange(event) {
    // Aplica el buque correcto a todos los mensajes cuando hay discrepancias.
    const selectedVessel = event.target.value;

    if (!selectedVessel) return;

    const selected = availableVessels.find(
      (item) => item.vessel === selectedVessel
    );

    if (!selected) return;

    const updatedData = editedData.map((message) => ({
      ...message,
      transport: {
        ...message.transport,
        selectedVessel: selected.vessel,
        vessel: selected.vessel,
        selectedLloyd: selected.lloyd,
        lloyd: selected.lloyd,
        loyd: selected.lloyd,
      },
    }));

    setEditedData(updatedData);
    setVesselDiscrepancy(false);
    setHasEdited(true);
  }

  function handleCancel() {
    navigate('/shipments/new');
  }

  async function handleGenerateEdi() {
    // Guarda los cambios y envia el EDI editado a la pantalla que reconstruye el archivo final.
    const payload = parsedRoot
      ? {
          ...parsedRoot,
          ediMessages: editedData,
        }
      : {
          ediMessages: editedData,
        };

    const savedShipmentId =
      location.state?.savedShipmentId ||
      location.state?.shipment?._id;

    if (hasEdited && savedShipmentId) {
      try {
        await updateShipment(savedShipmentId, {
          isEdited: true,
        });
      } catch (updateError) {
        console.error(updateError);
        setError('No se pudo marcar el EDI como editado.');
        return;
      }
    }

    navigate('/convert-edi', {
      state: {
        parsedData: editedData,
        ediPayload: payload,
        file: location.state?.file,
        savedShipmentId,
        isEditedDraft: hasEdited,
      },
    });
  }

  function handleViewDetails(message, index) {
    navigate(`/shipments/preview-${index}`, {
      state: {
        shipment: message,
        previewMode: true,
        previewReturn: {
          parsedData: editedData,
          file: location.state?.file,
          savedShipmentId: location.state?.savedShipmentId,
          isEditedDraft: hasEdited,
          index,
        },
      },
    });
  }

  if (loading) {
    return (
      <section className="page-card">
        <h2>Procesando archivo EDI...</h2>
      </section>
    );
  }

  if (error || !editedData) {
    return (
      <section className="page-card">
        <h2>Error</h2>
        <p>{error}</p>
      </section>
    );
  }

  return (
    <section className="edi-preview-page">

      <div className="preview-topbar">

        <div>
          <div className="hero-badge">
            <span className="badge-dot" />
            Previsualización EDI
          </div>

          <h1>Revisión de mensajes EDI</h1>

          <p>
            Revisa la información extraída, valida discrepancias y genera un
            archivo EDI consolidado para todos los BLs.
          </p>
        </div>

        <div className="topbar-actions">

          <button
            className="button-secondary"
            onClick={handleCancel}
          >
            Cancelar
          </button>

          <button
            className="button-primary"
            onClick={handleGenerateEdi}
          >
            Generar EDI
          </button>

        </div>

      </div>

      {vesselDiscrepancy && (
        <div className="edi-alert-card">
          <div>
            <strong>Discrepancia detectada en las naves</strong>
            <p>
              Se encontraron distintos buques en los BLs cargados. Selecciona
              el buque correcto para aplicar el cambio masivo. El código Lloyd
              se actualizará automáticamente.
            </p>
          </div>

          <select
            className="edi-alert-select"
            onChange={handleMassiveVesselChange}
            defaultValue=""
          >
            <option value="" disabled>
              Seleccionar buque correcto
            </option>

            {availableVessels.map((item) => (
              <option
                key={`${item.vessel}-${item.lloyd}`}
                value={item.vessel}
              >
                {item.vessel} — Lloyd: {item.lloyd || 'Sin Lloyd'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="edi-table-wrapper">

        <table className="edi-table-modern">

          <thead>
            <tr>
              <th>BL</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>ETA</th>
              <th>Lloyd</th>
              <th>Buque</th>
              <th>Cont.</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {editedData.map((message, index) => {
              const isEditing = editingRow === index;
              const transportData = getSelectedTransport(message);

              return (
                <tr key={index} className="main-row">

                  <td>
                    {isEditing ? (
                      <input
                        className="table-input"
                        value={message.referenceNumber || ''}
                        onChange={(e) =>
                          handleFieldChange(
                            index,
                            'referenceNumber',
                            e.target.value
                          )
                        }
                      />
                    ) : (
                      <div className="table-main-info">
                        {message.referenceNumber || '-'}
                      </div>
                    )}
                  </td>

                  <td>
                    <div className="table-secondary-info">
                      {getLocationDescription(
                        getLocationObject(message, 'origin')
                      )}
                    </div>
                  </td>

                  <td>
                    <div className="table-secondary-info">
                      {getLocationDescription(
                        getLocationObject(message, 'destination')
                      )}
                    </div>
                  </td>

                  <td>
                    <div className="table-date">
                      {transportData?.eta
                        ? new Date(transportData.eta).toLocaleDateString()
                        : '-'}
                    </div>
                  </td>

                  <td>
                    <div className="table-secondary-info">
                      {transportData?.lloyd || '-'}
                    </div>
                  </td>

                  <td>
                    <div className="table-main-info">
                      {transportData?.vessel || '-'}
                    </div>

                    <div className="table-sub-info">
                      Viaje: {transportData?.voyage || '-'}
                    </div>
                  </td>

                  <td>
                    <div className="container-badge">
                      {message.equipment?.containers?.length ||
                        message.containers?.length ||
                        0}
                    </div>
                  </td>

                  <td>
                    <div className="table-actions">

                      <button
                        className="detail-button"
                        onClick={() =>
                          handleViewDetails(message, index)
                        }
                      >
                        Ver detalles
                      </button>

                      <button
                        className="edit-button"
                        onClick={() =>
                          setEditingRow(isEditing ? null : index)
                        }
                      >
                        {isEditing ? 'Listo' : 'Editar'}
                      </button>

                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>

        </table>

      </div>

    </section>
  );
}

export default EdiPreviewPage;
