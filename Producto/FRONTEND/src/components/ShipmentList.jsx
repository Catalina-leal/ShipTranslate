import { Link } from 'react-router-dom';

// Componente de tabla/listado reutilizable para mostrar shipments.
// Se usa cuando se necesita presentar varios EDIs guardados.
function ShipmentList({ shipments }) {

  if (!shipments.length) {
    return (
      <section className="empty-shipments">

       

        <h2>
          No hay EDI registrados
        </h2>

        <p>
          Comienza cargando un nuevo archivo EDI
          o convirtiendo un PDF marítimo.
        </p>

        <Link
          to="/shipments/new"
          className="button-primary"
        >
          Cargar EDI
        </Link>

      </section>
    );
  }

  return (
    <section className="shipment-list-page">

      {/* =========================
          HEADER
      ========================= */}

      <div className="list-header">

        <div>

          <h1>
            Histórico de Envíos
          </h1>

          <p>
            Visualiza, revisa y administra
            todos los archivos procesados.
          </p>

        </div>

        <div className="list-header-actions">

          <Link
            to="/tracking"
            className="button-primary"
          >
            Leer PDF
          </Link>

          <Link
            to="/shipments/new"
            className="button-secondary"
          >
            Cargar EDI
          </Link>

        </div>

      </div>

      {/* =========================
          TABLA
      ========================= */}

      <div className="shipment-table-wrapper">

        <table className="shipment-table-modern">

          <thead>

            <tr>
              <th>Archivo</th>
              <th>Emisor</th>
              <th>Receptor</th>
              <th>Estado</th>
              <th>Editado</th>
              <th>Fecha</th>
              <th>ID Interchange</th>
              <th>Acciones</th>
            </tr>

          </thead>

          <tbody>

            {shipments.map((shipment) => (

              <tr key={shipment._id}>

                {/* ARCHIVO */}
                <td>

                  <div className="file-cell">


                    <div>

                      <div className="file-name">
                        {shipment.sourceFileName || '-'}
                      </div>

                      <div className="file-sub">
                        {shipment._id}
                      </div>

                    </div>

                  </div>

                </td>

                {/* EMISOR */}
                <td>

                  <div className="table-main-text">
                    {shipment.sender || 'Desconocido'}
                  </div>

                </td>

                {/* RECEPTOR */}
                <td>

                  <div className="table-main-text">
                    {shipment.receiver || 'Desconocido'}
                  </div>

                </td>

                {/* ESTADO */}
                <td>

                  <span
                    className={`status-pill ${
                      shipment.status === 'Procesado'
                        ? 'success'
                        : 'pending'
                    }`}
                  >
                    {shipment.status || 'Pendiente'}
                  </span>

                </td>

                {/* EDITADO */}
                <td>

                  <span
                    className={`edited-pill ${
                      shipment.isEdited
                        ? 'edited'
                        : 'not-edited'
                    }`}
                  >
                    {shipment.isEdited
                      ? 'Sí'
                      : 'No'}
                  </span>

                </td>

                {/* FECHA */}
                <td>

                  <div className="table-date">

                    {shipment.uploadDate
                      ? new Date(
                          shipment.uploadDate
                        ).toLocaleDateString()
                      : '-'}

                  </div>

                </td>

                {/* ID */}
                <td>

                  <div className="interchange-id">

                    {shipment.interchangeId || '-'}

                  </div>

                </td>

                {/* ACCIONES */}
                <td>

                  <div className="table-actions">

                    <Link
                      to={`/shipments/${shipment._id}`}
                      className="view-button"
                    >
                      Ver
                    </Link>

                  </div>

                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </section>
  );
}

export default ShipmentList;
