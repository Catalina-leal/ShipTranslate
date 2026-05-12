function ShipmentList({ shipments }) {
  if (!shipments.length) {
    return <p>No hay envíos registrados aún.</p>;
  }

  return (
    <section className="list-card">
      <h2>Lista de envíos</h2>
      <table>
        <thead>
          <tr>
            <th>Número Documento</th>
            <th>Origen</th>
            <th>Destino</th>
            <th>Cliente</th>
            <th>Peso (kg)</th>
            <th>Estado</th>
            <th>Fecha Documento</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment._id}>
              <td>{shipment.documentNumber}</td>
              <td>{shipment.origin}</td>
              <td>{shipment.destination}</td>
              <td>{shipment.client}</td>
              <td>{shipment.weight}</td>
              <td>{shipment.status}</td>
              <td>{shipment.dates?.documentDate ? new Date(shipment.dates.documentDate).toLocaleDateString() : '-'}</td>
              <td>
                <a href={`/shipments/${shipment._id}`} className="action-link">Ver detalles</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default ShipmentList;
