import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseEdiFile } from '../services/api.js';

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

  async function handleUpload(event) {
    event.preventDefault();
    if (!file) {
      setError('Selecciona un archivo EDI antes de continuar.');
      return;
    }

    setIsUploading(true);
    setError('');
    setMessage('Cargando archivo...');

    try {
      const parsedData = await parseEdiFile(file);
      setMessage('Archivo EDI procesado con éxito.');
      // Redirigir a la página de preview con la data parseada
      navigate('/edi-preview', { state: { parsedData, file } });
    } catch (uploadError) {
      const backendData = uploadError.response?.data;
      const serverMessage = backendData?.message;
      const serverDetails = backendData?.details;
      setError(
        serverMessage
          ? serverDetails
            ? `${serverMessage}: ${serverDetails}`
            : serverMessage
          : uploadError.message || 'Ocurrió un error al subir el archivo EDI.'
      );
      setMessage('');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="page-card">
      <h2>Cargar archivo EDI</h2>
      <p>
        Sube un archivo EDI válido para procesarlo según la naviera. Se aceptan archivos de texto con
        formato EDI. Después de subirlo, podrás revisar la información extraída antes de guardarla.
      </p>
      <form onSubmit={handleUpload}>
        <label>
          Archivo EDI
          <input type="file" accept=".edi,.txt" onChange={handleFileChange} />
        </label>
        {file && (
          <div className="file-info">
            <strong>Archivo seleccionado:</strong> {file.name} ({Math.round(file.size / 1024)} KB)
          </div>
        )}
        {message && <p className="message">{message}</p>}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={isUploading}>
          {isUploading ? 'Subiendo...' : 'Subir EDI'}
        </button>
      </form>
    </section>
  );
}

export default NewShipmentPage;
