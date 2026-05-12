import { useEffect, useState } from 'react';
import { fetchShipments } from '../services/api.js';
import ShipmentList from '../components/ShipmentList.jsx';

function ShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadShipments();
  }, []);

  async function loadShipments() {
    setLoading(true);
    try {
      const data = await fetchShipments();
      setShipments(data);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los envíos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-card">
      <h2>Lista de envíos</h2>
      {loading && <p>Cargando envíos...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && <ShipmentList shipments={shipments} />}
    </section>
  );
}

export default ShipmentsPage;
