import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import ShipmentsPage from './pages/ShipmentsPage.jsx';
import NewShipmentPage from './pages/NewShipmentPage.jsx';
import EdiPreviewPage from './pages/EdiPreviewPage.jsx';
import ShipmentDetailsPage from './pages/ShipmentDetailsPage.jsx';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header>
          <div className="header-top">
            <h1>ShipTranslate</h1>
            <nav>
              <Link to="/">Inicio</Link>
              <Link to="/shipments">EDI</Link>
              <Link to="/shipments/new">Nuevo EDI</Link>
            </nav>
          </div>
          <p>Gestión de EDI y transporte de mercancías.</p>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shipments" element={<ShipmentsPage />} />
            <Route path="/shipments/new" element={<NewShipmentPage />} />
            <Route path="/edi-preview" element={<EdiPreviewPage />} />
            <Route path="/shipments/:id" element={<ShipmentDetailsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
