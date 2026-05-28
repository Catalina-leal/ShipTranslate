import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parsePdfFile } from '../services/api.js';

// Pantalla de lectura de PDFs maritimos.
// Permite cargar un Bill of Lading en PDF, extraer datos y enviarlos a conversion EDI.
function Tracking() {

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [pdfData, setPdfData] =
    useState(null);

  const [error, setError] =
    useState('');

  const navigate = useNavigate();

  function setPdfFile(file) {
    // Valida que el usuario seleccione solo archivos PDF.
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith('.pdf')) {
      setSelectedFile(null);
      setPdfData(null);
      setError('Solo se permiten archivos PDF.');
      return;
    }

    setSelectedFile(file);
    setPdfData(null);
    setError('');
  }

  function handleDrop(event) {
    event.preventDefault();
    setPdfFile(event.dataTransfer.files[0] || null);
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  async function handleUpload() {
    // Envia el PDF al backend, donde se extrae texto y se estructura con IA.

    if (!selectedFile) {
      setError('Selecciona un archivo PDF antes de continuar.');
      return;
    }

    try {

      setLoading(true);
      setError('');

      const formData = new FormData();

      formData.append(
        'pdfFile',
        selectedFile
      );

      const response = await parsePdfFile(formData);

      setPdfData(response);

    } catch (err) {

      console.error(err?.response || err);

      setError(
        err?.response?.data?.message ||
          'Error procesando PDF'
      );

    } finally {

      setLoading(false);

    }
  }

  return (

    <section className="tracking-page">

      <div className="tracking-background-gradient" />

      <div className="tracking-container">

        {/* HERO */}
        <div className="tracking-hero">

          <div className="tracking-badge">
            <span className="badge-dot" />
            Inteligencia Artificial aplicada a logística marítima
          </div>

          <h1 className="tracking-title">
            Lectura inteligente de{' '}
            <span className="tracking-title-accent">
              PDFs marítimos
            </span>
          </h1>

          <p className="tracking-description">
            Extrae automáticamente información clave desde Bills of
            Lading y documentos marítimos utilizando IA especializada
            en operaciones logísticas y mensajes EDI.
          </p>

        </div>

        {/* UPLOAD CARD */}
        <div className="tracking-upload-card">

          <div className="tracking-upload-header">

            <div className="tracking-icon-wrapper">
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>

            <div>
              <h2>Subir PDF</h2>
              <p>
                Selecciona un documento PDF marítimo para analizarlo automáticamente.
              </p>
            </div>

          </div>

          <div className="tracking-upload-content">

            <label
              className="tracking-dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >

              <input
                type="file"
                accept=".pdf"
                hidden
                onChange={(e) =>
                  setPdfFile(e.target.files[0])
                }
              />

              <div className="tracking-dropzone-icon">
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>

              <strong>
                Haz clic para seleccionar un PDF
              </strong>

              <span>
                Compatible con Bills of Lading y documentos marítimos
              </span>

            </label>

            {selectedFile && (

              <div className="tracking-selected-file">

                <div className="tracking-selected-file-left">

                  <div className="tracking-file-icon">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>

                  <div className="tracking-file-info">

                    <strong>
                      {selectedFile.name}
                    </strong>

                    <span>
                      {Math.round(
                        selectedFile.size / 1024
                      )} KB
                    </span>

                  </div>

                </div>

                <div className="tracking-file-badge">
                  PDF
                </div>

              </div>

            )}

            {error && (
              <div className="tracking-error">
                {error}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading}
              className="tracking-button"
            >

              {loading
                ? 'Procesando PDF...'
                : 'Leer PDF'}

            </button>

          </div>

        </div>

        {/* RESULT */}
        {pdfData && (

          <div className="tracking-result-card">

            <div className="tracking-result-header">

              <div>
                <span className="tracking-result-label">
                  Resultado del análisis
                </span>

                <h3>
                  Información extraída
                </h3>
              </div>

              <button
                className="tracking-convert-button"
                onClick={() =>
                  navigate('/convert-edi', {
                    state: { pdfData },
                  })
                }
              >
                Convertir a EDI
              </button>

            </div>

            <div className="tracking-data-grid">

              {[
                ['BL', pdfData.blNumber],
                ['Booking', pdfData.bookingNumber],
                ['Buque', pdfData.vessel],
                ['Viaje', pdfData.voyage],
                ['Origen', pdfData.origin],
                ['Destino', pdfData.destination],
                ['Naviera', pdfData.carrier],
                ['Shipper', pdfData.shipper],
                ['Consignee', pdfData.consignee],
                ['Transbordo', pdfData.transshipment],
                ['Peso bruto', pdfData.grossWeight],
                ['Volumen', pdfData.volume],
                ['Flete', pdfData.freight],
                ['Descripción', pdfData.cargoDescription],
              ].map(([label, value]) => (

                <div
                  key={label}
                  className="tracking-data-card"
                >

                  <span>
                    {label}
                  </span>

                  <strong>
                    {value || '-'}
                  </strong>

                </div>

              ))}

            </div>

            {Array.isArray(pdfData.containers) &&
              pdfData.containers.length > 0 && (

                <div className="tracking-containers-section">

                  <div className="tracking-section-title">

                    <h4>
                      Contenedores
                    </h4>

                    <span>
                      {pdfData.containers.length} registrados
                    </span>

                  </div>

                  <div className="tracking-table-wrapper">

                    <table className="tracking-table">

                      <thead>
                        <tr>
                          {Object.keys(
                            pdfData.containers[0]
                          ).map((header) => (
                            <th key={header}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>

                        {pdfData.containers.map(
                          (container, index) => (

                            <tr key={index}>

                              {Object.values(container).map(
                                (
                                  value,
                                  cellIndex
                                ) => (

                                  <td key={cellIndex}>
                                    {typeof value === 'object'
                                      ? JSON.stringify(value)
                                      : value || '-'}
                                  </td>

                                )
                              )}

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                </div>

              )}

          </div>

        )}

      </div>

    </section>

  );
}

export default Tracking;
