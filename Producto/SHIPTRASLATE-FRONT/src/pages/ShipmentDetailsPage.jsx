import { useEffect, useState } from 'react';
import {
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';

import { fetchShipment } from '../services/api.js';

// Vista de detalle de un BL/mensaje EDI.
// Muestra informacion logistica, partes, rutas, mercancia y contenedores.
function ShipmentDetailsPage() {

  const { id } = useParams();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [shipment, setShipment] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  /* =========================
     HELPERS
  ========================= */

  function getLocationValue(
    value
  ) {
    // Normaliza ubicaciones que pueden venir como string o como objeto {code, name}.

    if (!value) return '-';

    if (
      typeof value === 'string'
    ) {

      const parts =
        value.split(':::');

      return (
        parts[1] ||
        parts[0] ||
        '-'
      );
    }

    return (
      value?.name ||
      value?.code ||
      '-'
    );
  }

  function formatDate(date) {

    if (!date) return '-';

    try {

      return new Date(
        date
      ).toLocaleDateString();

    } catch {

      return '-';
    }
  }

  function getPrimaryTransportLeg(
    message
  ) {

    if (
      !message?.transportLegs
        ?.length
    ) {
      return null;
    }

    return message.transportLegs.reduce(
      (best, leg) => {

        if (
          !best ||
          (leg.sequence || 0) >
            (best.sequence || 0)
        ) {
          return leg;
        }

        return best;
      },
      null
    );
  }

  function getTransportData(
    message
  ) {
    // Centraliza la lectura de buque, viaje, Lloyd, ETA, ETD y carrier.

    const primaryLeg =
      getPrimaryTransportLeg(
        message
      );

    return {

      vessel:
        message?.transport
          ?.selectedVessel ||
        message?.transport
          ?.vessel ||
        primaryLeg?.vessel ||
        '-',

      voyage:
        message?.transport
          ?.selectedVoyage ||
        message?.transport
          ?.voyage ||
        primaryLeg?.voyage ||
        '-',

      lloyd:
        message?.transport
          ?.selectedLloyd ||
        message?.transport
          ?.lloyd ||
        message?.transport
          ?.loyd ||
        primaryLeg?.lloyd ||
        primaryLeg?.loyd ||
        '-',

      eta:
        message?.transport
          ?.selectedETA ||
        message?.dates?.eta ||
        primaryLeg
          ?.arrivalDate ||
        '',

      etd:
        message?.transport
          ?.selectedETD ||
        message?.dates?.etd ||
        primaryLeg
          ?.departureDate ||
        '',

      carrier:
        message?.transport
          ?.selectedCarrier ||
        message?.transport
          ?.carrier ||
        primaryLeg?.carrier ||
        '-',
    };
  }

  /* =========================
     LOAD
  ========================= */

  useEffect(() => {

    if (
      location?.state
        ?.shipment
    ) {

      setShipment(
        location.state
          .shipment
      );

      setError(null);

      setLoading(false);

      return;
    }

    loadShipment();

  }, [id]);

  async function loadShipment() {

    setLoading(true);

    try {

      const data =
        await fetchShipment(id);

      setShipment(data);

      setError(null);

    } catch (err) {

      setError(
        'No se pudo cargar el envío.'
      );

    } finally {

      setLoading(false);
    }
  }

  /* =========================
     ACTIONS
  ========================= */

  function handleConvertToEDI() {

    alert(
      'Conversión a EDI iniciada.'
    );
  }

  function handleReturnToEdi() {

    const preview =
      location?.state
        ?.previewReturn;

    if (preview) {

      navigate(
        '/edi-preview',
        {
          state: preview,
        }
      );
    }
  }

  function handleDownloadJson() {

    const content =
      JSON.stringify(
        shipment,
        null,
        2
      );

    const blob =
      new Blob(
        [content],
        {
          type: 'application/json',
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        'a'
      );

    a.href = url;

    a.download = `${
      shipment.documentNumber ||
      shipment.referenceNumber ||
      'shipment'
    }.json`;

    a.click();

    URL.revokeObjectURL(
      url
    );
  }

  /* =========================
     LOADING
  ========================= */

  if (loading) {

    return (

      <section className="page-card">

        <h2>
          Cargando envío...
        </h2>

      </section>
    );
  }

  /* =========================
     ERROR
  ========================= */

  if (
    error ||
    !shipment
  ) {

    return (

      <section className="page-card">

        <h2>
          Error
        </h2>

        <p className="error">
          {error ||
            'Envío no encontrado'}
        </p>

        <button
          className="button-secondary"
          onClick={() =>
            navigate(
              '/shipments'
            )
          }
        >
          Volver
        </button>

      </section>
    );
  }

  const transportData =
    getTransportData(
      shipment
    );

  const containers =
    shipment?.equipment
      ?.containers ||
    shipment?.containers ||
    [];

  return (

    <section className="shipment-details-page modern-details-page">

      {/* HERO */}

      <div className="details-hero">

        <div>

          <div className="hero-chip">
            EDI MARÍTIMO
          </div>

          <h1>
            {
              shipment.referenceNumber ||
              shipment.documentNumber ||
              'Shipment'
            }
          </h1>

          <p>
            Información logística,
            transporte marítimo,
            contenedores y datos
            estructurados EDI.
          </p>

        </div>

        <div className="hero-status">

          {shipment.isEdited && (

            <div className="status-pill edited">
              EDI EDITADO
            </div>

          )}

          {location?.state
            ?.previewMode && (

            <div className="status-pill preview">
              PREVIEW
            </div>

          )}

        </div>

      </div>

      {/* ACTIONS */}

      <div className="details-actions">



        {location?.state
          ?.previewMode && (

          <button
            className="button-secondary"
            onClick={
              handleReturnToEdi
            }
          >
            Volver al EDI
          </button>

        )}

        <button
          className="button-secondary"
          onClick={
            handleDownloadJson
          }
        >
          Descargar JSON
        </button>

        <button
          className="button-primary"
          onClick={
            handleConvertToEDI
          }
        >
          Convertir a EDI
        </button>

      </div>

      {/* SUMMARY */}

      <div className="summary-grid">

        <div className="summary-card">
          <span>Buque</span>
          <strong>
            {
              transportData.vessel
            }
          </strong>

          <small>
            Viaje:{' '}
            {
              transportData.voyage
            }
          </small>
        </div>

        <div className="summary-card">
          <span>Lloyd</span>

          <strong>
            {
              transportData.lloyd
            }
          </strong>
        </div>

        <div className="summary-card">
          <span>ETA</span>

          <strong>
            {formatDate(
              transportData.eta
            )}
          </strong>
        </div>

        <div className="summary-card">
          <span>Contenedores</span>

          <strong>
            {
              containers.length
            }
          </strong>
        </div>

      </div>

      {/* GRID */}

      <div className="details-grid">

        {/* GENERAL */}

        <div className="detail-card modern-card">

          <div className="card-title">
            Información General
          </div>

          <div className="info-grid">

            <div className="info-item">
              <span>BL</span>

              <strong>
                {
                  shipment.referenceNumber ||
                  shipment.documentNumber ||
                  '-'
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Status</span>

              <strong>
                {
                  shipment.status ||
                  '-'
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Message Type</span>

              <strong>
                {
                  shipment.messageType ||
                  '-'
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Message ID</span>

              <strong>
                {
                  shipment.messageId ||
                  '-'
                }
              </strong>
            </div>

          </div>

        </div>

        {/* PARTIES */}

        <div className="detail-card modern-card full-width">

          <div className="card-title">
            Parties
          </div>

          <div className="parties-grid">

            <div className="party-card">

              <div className="party-header">
                SHIPPER
              </div>

              <div className="party-content">
                {
                  shipment.parties
                    ?.shipper ||
                  '-'
                }
              </div>

            </div>

            <div className="party-card">

              <div className="party-header">
                CONSIGNEE
              </div>

              <div className="party-content">
                {
                  shipment.parties
                    ?.consignee ||
                  '-'
                }
              </div>

            </div>

            <div className="party-card">

              <div className="party-header">
                NOTIFY
              </div>

              <div className="party-content">
                {
                  shipment.parties
                    ?.notify ||
                  '-'
                }
              </div>

            </div>

          </div>

        </div>

        {/* ROUTE */}

        <div className="detail-card modern-card">

          <div className="card-title">
            Ruta Logística
          </div>

          <div className="route-box">

            <div className="route-point">

              <span>
                ORIGEN
              </span>

              <strong>

                {getLocationValue(
                  shipment
                    ?.locations
                    ?.origin ||
                    shipment.origin
                )}

              </strong>

            </div>

            <div className="route-arrow">
              →
            </div>

            <div className="route-point">

              <span>
                DESTINO
              </span>

              <strong>

                {getLocationValue(
                  shipment
                    ?.locations
                    ?.destination ||
                    shipment.destination
                )}

              </strong>

            </div>

          </div>

        </div>

        {/* TRANSPORTE */}

        <div className="detail-card modern-card">

          <div className="card-title">
            Transporte
          </div>

          <div className="info-grid">

            <div className="info-item">
              <span>Buque</span>

              <strong>
                {
                  transportData.vessel
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Viaje</span>

              <strong>
                {
                  transportData.voyage
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Lloyd</span>

              <strong>
                {
                  transportData.lloyd
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Carrier</span>

              <strong>
                {
                  transportData.carrier
                }
              </strong>
            </div>

          </div>

        </div>

        {/* LOCATIONS */}

        <div className="detail-card modern-card full-width">

          <div className="card-title">
            Locations
          </div>

          <div className="info-grid">

            <div className="info-item">
              <span>Port Of Loading</span>

              <strong>

                {getLocationValue(
                  shipment
                    ?.locations
                    ?.portOfLoading
                )}

              </strong>
            </div>

            <div className="info-item">
              <span>Port Of Discharge</span>

              <strong>

                {getLocationValue(
                  shipment
                    ?.locations
                    ?.portOfDischarge
                )}

              </strong>
            </div>

            <div className="info-item">
              <span>Reference Location</span>

              <strong>

                {getLocationValue(
                  shipment
                    ?.locations
                    ?.referenceLocation
                )}

              </strong>
            </div>

          </div>

        </div>

        {/* GOODS */}

        <div className="detail-card modern-card full-width">

          <div className="card-title">
            Mercancía
          </div>

          <div className="goods-grid">

            <div className="info-item">
              <span>Description</span>

              <strong>
                {
                  shipment.goods
                    ?.description ||
                  '-'
                }
              </strong>
            </div>

            <div className="info-item">
              <span>HS Code</span>

              <strong>
                {
                  shipment.goods
                    ?.hsCode ||
                  '-'
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Packages</span>

              <strong>
                {
                  shipment.goods
                    ?.packages ||
                  '-'
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Gross Weight</span>

              <strong>
                {
                  shipment.goods
                    ?.grossWeight ||
                  '-'
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Net Weight</span>

              <strong>
                {
                  shipment.goods
                    ?.netWeight ||
                  '-'
                }
              </strong>
            </div>

            <div className="info-item">
              <span>Volume</span>

              <strong>
                {
                  shipment.goods
                    ?.volume ||
                  '-'
                }
              </strong>
            </div>

          </div>

        </div>

        {/* CONTAINERS */}

        {containers.length >
          0 && (

          <div className="detail-card modern-card full-width">

            <div className="card-title">
              Contenedores
            </div>

            <div className="containers-grid">

              {containers.map(
                (
                  container,
                  index
                ) => (

                  <div
                    key={index}
                    className="container-card modern-container-card"
                  >

                    <div className="container-number">
                      {
                        container.number ||
                        '-'
                      }
                    </div>

                    <div className="container-info">

                      <p>
                        <strong>
                          Tipo:
                        </strong>{' '}

                        {
                          container.type ||
                          '-'
                        }
                      </p>

                      <p>
                        <strong>
                          Peso:
                        </strong>{' '}

                        {
                          container.grossWeight ||
                          '-'
                        }
                      </p>

                      <p>
                        <strong>
                          Volumen:
                        </strong>{' '}

                        {
                          container.volume ||
                          '-'
                        }
                      </p>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>

        )}

      </div>

    </section>
  );
}

export default ShipmentDetailsPage;
