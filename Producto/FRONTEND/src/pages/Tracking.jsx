import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parsePdfFile, updateTracking } from '../services/api.js';
import {
  REQUIRED_SCANNED_FIELDS,
  REQUIRED_TRAMP_FIELDS,
  hasMissingRequiredFields,
  hasMissingRequiredTrampFields as someTrampFieldsAreMissing,
  isRequiredFieldMissing,
} from '../utils/trackingValidation.js';

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

  const [savingTracking, setSavingTracking] =
    useState(false);

  const [saveMessage, setSaveMessage] =
    useState('');

  const [showRequiredWarning, setShowRequiredWarning] =
    useState(false);

  const [showBulkWarning, setShowBulkWarning] =
    useState(false);

  const [bulkChanges, setBulkChanges] =
    useState({
      portOfDischarge: '',
      prepaidAt: '',
      placeOfIssue: '',
      dateOfIssue: '',
    });

  const navigate = useNavigate();
  const trampBls = Array.isArray(pdfData?.bls) ? pdfData.bls : [];
  const hasMultipleBls = trampBls.length > 1;
  const isScannedBl =
    Boolean(pdfData) &&
    !hasMultipleBls &&
    ['pdf-ocr', 'image-ocr'].includes(pdfData.extractionMode);

  const scannedBlFields = [
    ['Shipper', 'shipper', 'party'],
    ['Consignee', 'consignee', 'party'],
    ['Notify address', 'notify', 'party'],
    ['Vessel', 'vessel', 'short'],
    ['Port of discharge', 'portOfDischarge', 'short'],
    ['Marks & Numbers', 'marks', 'wide'],
    ['Port of loading', 'portOfLoading', 'short'],
    ['No. & Kind of pkgs', 'packagesSummary', 'wide'],
    ['Description of goods', 'cargoDescription', 'full'],
    ['Gross weight', 'grossWeight', 'short'],
    ['Freight payable at', 'freightPayableAt', 'short'],
  ];

  const trampBlFields = [
    ['B/L NO.', 'blNumber', 'short'],
    ['Shipper', 'shipper', 'party'],
    ['Consignee', 'consignee', 'party'],
    ['Notify Party', 'notifyParty', 'party'],
    ['Ocean Vessel', 'oceanVessel', 'short'],
    ['Voy. No.', 'voyageNo', 'short'],
    ['Port of Loading', 'portOfLoading', 'short'],
    ['Port of Discharge', 'portOfDischarge', 'short'],
    ['Marks / Numbers', 'marksNumbers', 'wide'],
    ["No.of P'kgs or Units", 'packages', 'short'],
    ['Kind of packages or Units', 'packageType', 'short'],
    ['Description of Goods', 'goodsDescription', 'full'],
    ['Gross Weight (KG)', 'grossWeightKg', 'short'],
    ['Measurement', 'measurement', 'short'],
    ['Prepaid at', 'prepaidAt', 'short'],
    ['Place', 'placeOfIssue', 'short'],
    ['Date of issue', 'dateOfIssue', 'short'],
  ];

  const bulkChangeFields = [
    ['Port of Discharge', 'portOfDischarge'],
    ['Prepaid at', 'prepaidAt'],
    ['Place', 'placeOfIssue'],
    ['Date of issue', 'dateOfIssue'],
  ];

  function isMissingRequiredTrampField(bl, field) {
    return isRequiredFieldMissing(bl, field, REQUIRED_TRAMP_FIELDS);
  }

  function hasMissingRequiredTrampFields() {
    return someTrampFieldsAreMissing(trampBls);
  }

  function isMissingRequiredScannedField(field) {
    return isRequiredFieldMissing(pdfData, field, REQUIRED_SCANNED_FIELDS);
  }

  function hasMissingRequiredScannedFields() {
    return hasMissingRequiredFields(pdfData, REQUIRED_SCANNED_FIELDS);
  }

  function getTrampFieldRows(value, size) {
    const text = String(value || '');
    const charsPerLine = size === 'full'
      ? 86
      : size === 'wide' || size === 'party'
        ? 58
        : 30;
    const softRows = text
      .split('\n')
      .reduce(
        (total, line) =>
          total + Math.max(1, Math.ceil(line.length / charsPerLine)),
        0
      );
    const minRows = size === 'full' ? 4 : size === 'wide' || size === 'party' ? 3 : 1;
    const maxRows = size === 'full' ? 24 : size === 'wide' || size === 'party' ? 16 : 8;

    return Math.min(maxRows, Math.max(minRows, softRows));
  }

  function setPdfFile(file) {
    // Valida que el usuario seleccione solo archivos PDF.
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const allowedExtensions = [
      '.pdf',
      '.jpg',
      '.jpeg',
      '.png',
      '.webp',
      '.tif',
      '.tiff',
      '.bmp',
    ];

    if (!allowedExtensions.some((extension) => fileName.endsWith(extension))) {
      setSelectedFile(null);
      setPdfData(null);
      setError('Solo se permiten archivos PDF o imagenes.');
      setSaveMessage('');
      setShowRequiredWarning(false);
      return;
    }

    setSelectedFile(file);
    setPdfData(null);
    setError('');
    setSaveMessage('');
    setShowRequiredWarning(false);
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
      setSaveMessage('');

      const formData = new FormData();

      formData.append(
        'pdfFile',
        selectedFile
      );

      const response = await parsePdfFile(formData);

      setPdfData(normalizeTrackingResponse(response));

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

  function normalizeTrackingResponse(response) {
    const normalizedResponse = Array.isArray(response?.bls)
      ? {
          ...response,
          bls: response.bls.map(normalizeTrampBlIssueFields),
        }
      : response;

    if (
      !normalizedResponse ||
      !['pdf-ocr', 'image-ocr'].includes(normalizedResponse.extractionMode)
    ) {
      return normalizedResponse;
    }

    return {
      ...normalizedResponse,
      packagesSummary:
        normalizedResponse.packagesSummary ||
        [normalizedResponse.packages, normalizedResponse.packageType]
          .filter(Boolean)
          .join(' ')
          .trim(),
      freightPayableAt:
        normalizedResponse.freightPayableAt ||
        normalizedResponse.freight ||
        normalizedResponse.freightCondition ||
        '',
    };
  }

  function normalizeTrampBlIssueFields(bl) {
    if (bl.placeOfIssue && bl.dateOfIssue) {
      return bl;
    }

    const placeDateText = String(bl.placeDateOfIssue || '').trim();
    const dateMatch = placeDateText.match(/\d{2}-\d{2}-\d{4}$/);

    if (!dateMatch) {
      return bl;
    }

    return {
      ...bl,
      placeOfIssue: bl.placeOfIssue || placeDateText.slice(0, dateMatch.index).trim(),
      dateOfIssue: bl.dateOfIssue || dateMatch[0],
    };
  }

  function handleBlFieldChange(index, field, value) {
    setPdfData((currentData) => {
      if (!currentData || !Array.isArray(currentData.bls)) {
        return currentData;
      }

      const updatedBls = currentData.bls.map((bl, blIndex) => {
        if (blIndex !== index) {
          return bl;
        }

        return {
          ...bl,
          [field]: value,
        };
      });

      return {
        ...currentData,
        bls: updatedBls,
        blCount: updatedBls.length,
      };
    });

    setSaveMessage('');
  }

  function handleBulkChange(field, value) {
    setBulkChanges((currentChanges) => ({
      ...currentChanges,
      [field]: value,
    }));
  }

  function hasBulkChanges() {
    return Object.values(bulkChanges).some((value) =>
      String(value || '').trim()
    );
  }

  function handleRequestApplyBulkChanges() {
    if (!hasBulkChanges()) {
      setSaveMessage(
        'Ingresa al menos un campo para modificar masivamente.'
      );
      return;
    }

    setShowBulkWarning(true);
  }

  function handleApplyBulkChanges() {
    const updates = Object.fromEntries(
      Object.entries(bulkChanges)
        .map(([field, value]) => [field, String(value || '').trim()])
        .filter(([, value]) => value)
    );

    setPdfData((currentData) => {
      if (!currentData || !Array.isArray(currentData.bls)) {
        return currentData;
      }

      const updatedBls = currentData.bls.map((bl) => ({
        ...bl,
        ...updates,
      }));

      return {
        ...currentData,
        bls: updatedBls,
        blCount: updatedBls.length,
      };
    });

    setShowBulkWarning(false);
    setSaveMessage('');
  }

  function handleCancelBulkChanges() {
    setShowBulkWarning(false);
  }

  function handleClearBulkChanges() {
    setBulkChanges({
      portOfDischarge: '',
      prepaidAt: '',
      placeOfIssue: '',
      dateOfIssue: '',
    });
    setSaveMessage('');
  }

  function handleScannedFieldChange(field, value) {
    setPdfData((currentData) => ({
      ...currentData,
      [field]: value,
    }));

    setSaveMessage('');
  }

  async function handleSaveTrampTracking() {
    if (hasMissingRequiredTrampFields()) {
      setShowRequiredWarning(true);
      return;
    }

    await saveTrampTracking();
  }

  async function handleSaveScannedTracking() {
    if (hasMissingRequiredScannedFields()) {
      setShowRequiredWarning(true);
      return;
    }

    await saveScannedTracking();
  }

  async function saveTrampTracking() {
    if (!pdfData?.trackingId) {
      setSaveMessage(
        'No se encontro el identificador del tracking para guardar.'
      );
      return;
    }

    try {
      setSavingTracking(true);
      setSaveMessage('');

      const response = await updateTracking(
        pdfData.trackingId,
        buildEditableTrampData()
      );

      setPdfData((currentData) => ({
        ...currentData,
        trackingId:
          response?.tracking?._id ||
          response?.tracking?.id ||
          pdfData.trackingId,
      }));

      navigate('/', {
        state: {
          toastMessage: 'Cambios guardados',
        },
      });
    } catch (err) {
      console.error(err?.response || err);
      setSaveMessage(
        err?.response?.data?.message ||
          'No se pudo guardar la informacion editada.'
      );
    } finally {
      setSavingTracking(false);
    }
  }

  async function saveScannedTracking() {
    if (!pdfData?.trackingId) {
      setSaveMessage(
        'No se encontro el identificador del tracking para guardar.'
      );
      return;
    }

    try {
      setSavingTracking(true);
      setSaveMessage('');

      const response = await updateTracking(
        pdfData.trackingId,
        buildEditableScannedData()
      );

      setPdfData((currentData) => ({
        ...currentData,
        trackingId:
          response?.tracking?._id ||
          response?.tracking?.id ||
          pdfData.trackingId,
      }));

      navigate('/', {
        state: {
          toastMessage: 'Cambios guardados',
        },
      });
    } catch (err) {
      console.error(err?.response || err);
      setSaveMessage(
        err?.response?.data?.message ||
          'No se pudo guardar la informacion editada.'
      );
    } finally {
      setSavingTracking(false);
    }
  }

  async function handleConfirmSaveWithMissingFields() {
    setShowRequiredWarning(false);
    if (isScannedBl) {
      await saveScannedTracking();
      return;
    }

    await saveTrampTracking();
  }

  function handleCancelSaveWithMissingFields() {
    setShowRequiredWarning(false);
  }

  function buildEditableTrampData() {
    const editableData = { ...pdfData };
    delete editableData.trackingId;
    delete editableData.success;
    delete editableData.rawText;

    const editableBls = trampBls.map((bl) => {
      const editableBl = { ...bl };
      delete editableBl.rawText;
      return editableBl;
    });

    return {
      ...editableData,
      bls: editableBls,
      blCount: editableBls.length,
      documentType: pdfData.documentType || 'tramp-import',
    };
  }

  function buildEditableScannedData() {
    const editableData = { ...pdfData };
    delete editableData.trackingId;
    delete editableData.success;
    delete editableData.rawText;

    return {
      ...editableData,
      documentType: 'scanned-bl',
    };
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
              <h2>Subir PDF o imagen</h2>
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
                accept=".pdf,.jpg,.jpeg,.png,.webp,.tif,.tiff,.bmp,image/*"
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
                Haz clic para seleccionar un PDF o imagen
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
                  {selectedFile.type?.startsWith('image/')
                    ? 'IMG'
                    : 'PDF'}
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
                ? 'Procesando archivo...'
                : 'Leer archivo'}

            </button>

          </div>

        </div>

        {hasMultipleBls && (
          <div className="tracking-bulk-card">
            <div className="tracking-bulk-header">
              <div>
                <span>
                  Modificaciones masivas
                </span>
                <h3>
                  Correcciones para todos los BLs
                </h3>
              </div>
            </div>

            <div className="tracking-bulk-grid">
              {bulkChangeFields.map(([label, field]) => (
                <label className="tracking-bulk-field" key={field}>
                  <span>{label}</span>
                  <input
                    value={bulkChanges[field]}
                    onChange={(event) =>
                      handleBulkChange(field, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>

            <div className="tracking-bulk-actions">
              <button
                type="button"
                className="tracking-bulk-apply"
                onClick={handleRequestApplyBulkChanges}
              >
                Modificar
              </button>

              <button
                type="button"
                className="tracking-bulk-clear"
                onClick={handleClearBulkChanges}
              >
                Limpiar campos
              </button>
            </div>
          </div>
        )}

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

              {!hasMultipleBls && !isScannedBl && (
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
              )}

            </div>

            {hasMultipleBls && (
              <div className="tracking-multiple-summary">
                <div>
                  <strong>
                    {trampBls.length} BLs detectados
                  </strong>
                <span>
                  Documento tramp importación separado por hoja.
                  </span>
                </div>
                <button
                  type="button"
                  className="tracking-save-button"
                  onClick={handleSaveTrampTracking}
                  disabled={savingTracking}
                >
                  {savingTracking
                    ? 'Guardando...'
                    : 'Guardar cambios'}
                </button>
              </div>
            )}

            {hasMultipleBls && saveMessage && (
              <div className="tracking-save-message">
                {saveMessage}
              </div>
            )}

            {isScannedBl && (
              <div className="tracking-multiple-summary">
                <div>
                  <strong>
                    BL escaneado detectado
                  </strong>
                  <span>
                    Informacion extraida por OCR para revision de digitacion.
                  </span>
                </div>

                <button
                  type="button"
                  className="tracking-save-button"
                  onClick={handleSaveScannedTracking}
                  disabled={savingTracking}
                >
                  {savingTracking
                    ? 'Guardando...'
                    : 'Guardar cambios'}
                </button>
              </div>
            )}

            {isScannedBl && saveMessage && (
              <div className="tracking-save-message">
                {saveMessage}
              </div>
            )}

            {!hasMultipleBls && !isScannedBl && (
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
            )}

            {isScannedBl && (
              <div className="tracking-bls-section">
                <div className="tracking-bl-card">
                  <div className="tracking-bl-card-header">
                    <div>
                      <span>OCR</span>
                      <h4>{pdfData.blNumber || 'BL escaneado'}</h4>
                    </div>

                    <strong>
                      {pdfData.grossWeight || '-'}
                    </strong>
                  </div>

                  <div className="tracking-bl-grid">
                    {scannedBlFields.map(([label, field, size]) => (
                      <div
                        className={`tracking-bl-field ${
                          size === 'wide' || size === 'full' || size === 'party'
                            ? 'tracking-bl-field-wide'
                            : ''
                        } ${
                          size === 'full'
                            ? 'tracking-bl-field-full'
                            : ''
                        } ${
                          isMissingRequiredScannedField(field)
                            ? 'tracking-bl-field-missing'
                            : ''
                        }`}
                        key={field}
                      >
                        <span>{label}</span>
                        <textarea
                          value={pdfData[field] || ''}
                          rows={getTrampFieldRows(pdfData[field], size)}
                          onChange={(event) =>
                            handleScannedFieldChange(
                              field,
                              event.target.value
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {hasMultipleBls && (
              <div className="tracking-bls-section">
                {trampBls.map((bl, blIndex) => (
                  <div className="tracking-bl-card" key={`${bl.page}-${bl.blNumber}`}>
                    <div className="tracking-bl-card-header">
                      <div>
                        <span>Hoja {bl.page}</span>
                        <h4>{bl.blNumber || 'BL sin numero'}</h4>
                      </div>

                      <strong>
                        {bl.grossWeightKg ? `${bl.grossWeightKg} KG` : '-'}
                      </strong>
                    </div>

                    <div className="tracking-bl-grid">
                      {trampBlFields.map(([label, field, size]) => (
                        <div
                          className={`tracking-bl-field ${
                            size === 'wide' || size === 'full' || size === 'party'
                              ? 'tracking-bl-field-wide'
                              : ''
                          } ${
                            size === 'full'
                              ? 'tracking-bl-field-full'
                              : ''
                          } ${
                            isMissingRequiredTrampField(bl, field)
                              ? 'tracking-bl-field-missing'
                              : ''
                          }`}
                          key={field}
                        >
                          <span>{label}</span>
                          <textarea
                            value={bl[field] || ''}
                            rows={getTrampFieldRows(bl[field], size)}
                            onChange={(event) =>
                              handleBlFieldChange(
                                blIndex,
                                field,
                                event.target.value
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {Array.isArray(pdfData.containers) &&
              !hasMultipleBls &&
              !isScannedBl &&
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

      {showRequiredWarning && (
        <div className="tracking-warning-overlay" role="dialog" aria-modal="true">
          <div className="tracking-warning-modal">
            <span className="tracking-warning-label">
              Campos obligatorios pendientes
            </span>

            <h3>
              No todos los campos obligatorios fueron ingresados, desea guardar?
            </h3>

            <div className="tracking-warning-actions">
              <button
                type="button"
                className="tracking-warning-confirm"
                onClick={handleConfirmSaveWithMissingFields}
                disabled={savingTracking}
              >
                Si
              </button>

              <button
                type="button"
                className="tracking-warning-cancel"
                onClick={handleCancelSaveWithMissingFields}
                disabled={savingTracking}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkWarning && (
        <div className="tracking-warning-overlay" role="dialog" aria-modal="true">
          <div className="tracking-warning-modal">
            <span className="tracking-warning-label">
              Confirmar modificacion
            </span>

            <h3>
              Desea aplicar estos cambios masivos?
            </h3>

            <div className="tracking-warning-actions">
              <button
                type="button"
                className="tracking-warning-confirm"
                onClick={handleApplyBulkChanges}
              >
                Si
              </button>

              <button
                type="button"
                className="tracking-warning-cancel"
                onClick={handleCancelBulkChanges}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

    </section>

  );
}

export default Tracking;
