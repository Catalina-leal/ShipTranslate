import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseEdiFile, uploadEdiFile } from '../services/api.js';

// Pantalla para cargar archivos .EDI o .TXT.
// Es el inicio del flujo operacional: subir, parsear, guardar y pasar a vista previa.
function NewShipmentPage() {

  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const navigate = useNavigate();

  function handleFileChange(event) {
    setFile(event.target.files[0] || null);

    setError('');
    setMessage('');
  }

  function handleDrop(event) {
    event.preventDefault();

    const droppedFile = event.dataTransfer.files[0] || null;

    if (!droppedFile) return;

    const fileName = droppedFile.name.toLowerCase();
    const isValidFile =
      fileName.endsWith('.edi') ||
      fileName.endsWith('.txt');

    if (!isValidFile) {
      setFile(null);
      setMessage('');
      setError('Solo se permiten archivos .EDI o .TXT.');
      return;
    }

    setFile(droppedFile);
    setError('');
    setMessage('');
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  async function handleUpload(event) {

    event.preventDefault();

    if (!file) {
      setError(
        'Selecciona un archivo EDI antes de continuar.'
      );

      return;
    }

    setIsUploading(true);
    setError('');
    setMessage('Procesando archivo EDI...');

    try {

      // Primero se parsea para mostrar datos legibles al usuario.
      const parsedData = await parseEdiFile(file);

      setMessage(
        'Archivo EDI procesado correctamente.'
      );

      // Luego se guarda el archivo procesado en MongoDB.
      const savedShipment = await uploadEdiFile(file);

      navigate('/edi-preview', {
        state: {
          parsedData,
          file,
          savedShipmentId: savedShipment._id,
        },
      });

    } catch (uploadError) {

      const backendData = uploadError.response?.data;
      const serverMessage = backendData?.message;
      const serverDetails = backendData?.details;

      setError(
        serverMessage
          ? serverDetails
            ? `${serverMessage}: ${serverDetails}`
            : serverMessage
          : uploadError.message || 'Ocurrió un error al subir el archivo.'
      );

      setMessage('');

    } finally {

      setIsUploading(false);

    }
  }

  return (

    <section className="modern-upload-page">

      {/* BACKGROUND */}
      <div className="upload-background-gradient" />

      <div className="upload-layout">

        {/* LEFT */}
        <div className="upload-left">

          <div className="hero-badge">
            <span className="badge-dot" />
            Carga y validación inteligente
          </div>

          <h1 className="hero-title">
            Importa archivos{' '}
            <span className="hero-title-accent">
              EDI
            </span>{' '}
            para procesarlos automáticamente
          </h1>

          <p className="hero-description">
            Carga documentos EDI marítimos para
            validarlos, analizarlos y convertirlos
            en información estructurada utilizando
            inteligencia artificial enfocada en logística.
          </p>

          {/* FEATURES */}
          <div className="upload-features">

            <div className="upload-feature-card">
              <div className="feature-icon feature-icon-blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>

              <div>
                <strong>Lectura automática</strong>
                <span>Extracción inteligente de segmentos EDI</span>
              </div>
            </div>

            <div className="upload-feature-card">
              <div className="feature-icon feature-icon-purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>

              <div>
                <strong>Validación EDI</strong>
                <span>Detección de errores y discrepancias</span>
              </div>
            </div>

            <div className="upload-feature-card">
              <div className="feature-icon feature-icon-teal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>

              <div>
                <strong>Procesamiento IA</strong>
                <span>Optimización documental marítima</span>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT */}
        <div className="upload-right">

          <div className="upload-card-modern">

            <div className="upload-card-header">

              <div className="upload-icon-wrapper">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
              </div>

              <h2>
                Cargar archivo EDI
              </h2>

              <p>
                Formatos soportados: .EDI y .TXT
              </p>

            </div>

            <form
              onSubmit={handleUpload}
              className="upload-form-modern"
            >

              <label
                className="upload-dropzone-modern"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >

                <div className="dropzone-icon">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 16 12 12 8 16"/>
                    <line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  </svg>
                </div>

                <strong>
                  Haz clic para seleccionar
                </strong>

                <span>
                  o arrastra tu archivo EDI aquí
                </span>

                <input
                  type="file"
                  accept=".edi,.txt"
                  onChange={handleFileChange}
                  hidden
                />

              </label>

              {file && (

                <div className="selected-file-modern">

                  <div className="selected-file-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>

                  <div className="selected-file-info">

                    <strong>
                      {file.name}
                    </strong>

                    <span>
                      {Math.round(file.size / 1024)} KB
                    </span>

                  </div>

                </div>

              )}

              {message && (
                <div className="upload-message-modern">
                  {message}
                </div>
              )}

              {error && (
                <div className="upload-error-modern">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading}
                className="upload-button-modern"
              >

                {isUploading ? (
                  <>
                    <span className="button-loader" />
                    Procesando EDI...
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 16 12 12 8 16"/>
                      <line x1="12" y1="12" x2="12" y2="21"/>
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                    </svg>

                    Procesar archivo
                  </>
                )}

              </button>

            </form>

          </div>

        </div>

      </div>

    </section>

  );
}

export default NewShipmentPage;
