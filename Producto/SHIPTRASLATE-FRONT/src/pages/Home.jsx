import { Link } from 'react-router-dom';

function Home() {
  return (
    <section className="page-card">
      <h2>Bienvenido a ShipTranslate</h2>
      <p>Administra tus EDI y controla el estado de la carga de manera sencilla.</p>
      <div className="page-actions">
        <Link className="button" to="/shipments">
          Histórico de EDI
        </Link>
        <Link className="button button-secondary" to="/shipments/new">
          Cargar EDI
        </Link>
      </div>
    </section>
  );
}

export default Home;
