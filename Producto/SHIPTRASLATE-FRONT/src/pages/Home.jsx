import { Link } from 'react-router-dom';
import shipImage from '../assets/ship.webp';

// Inicio para usuarios operacionales.
// Presenta el flujo principal: cargar EDI, revisar historico y leer PDFs.
function Home() {
  return (
    <section className="modern-home">

      {/* BACKGROUND */}
      <div className="home-background-gradient" />

      {/* HERO */}
      <div className="hero-layout">

        {/* LEFT */}
        <div className="hero-left">

          <div className="hero-badge">
            <span className="badge-dot" />
            Plataforma Inteligente de Logística Marítima
          </div>

          <h1 className="hero-title">
            Convierte PDFs marítimos en mensajes{' '}
            <span className="hero-title-accent">EDI</span>{' '}
            usando IA
          </h1>

          <p className="hero-description">
            Automatiza la lectura de Bills of Lading, transforma documentos PDF
            en estructuras EDI y corrige mensajes con errores utilizando
            inteligencia artificial enfocada en logística marítima.
          </p>

          {/* BUTTONS */}
          <div className="hero-actions">
            <Link className="btn-primary-hero" to="/tracking">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Leer PDF
            </Link>

            <Link className="btn-secondary-hero" to="/shipments/new">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="16 16 12 12 8 16"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
              Cargar EDI
            </Link>

            <Link className="btn-ghost-hero" to="/shipments">
              Histórico
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          </div>

          {/* STATS */}
          <div className="hero-stats">
            <div className="hero-stat-card">
              <div className="stat-icon stat-icon-blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <strong>PDF</strong>
              <span>Lectura inteligente</span>
            </div>

            <div className="hero-stat-card">
              <div className="stat-icon stat-icon-purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <strong>IA</strong>
              <span>Extracción automática</span>
            </div>

            <div className="hero-stat-card">
              <div className="stat-icon stat-icon-teal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <strong>EDI</strong>
              <span>Conversión avanzada</span>
            </div>
          </div>

        </div>

        {/* RIGHT */}
        <div className="hero-right">
          <div className="hero-image-card">
            <div className="image-shine" />
            <img
              src={shipImage}
              alt="Buque marítimo"
              className="hero-image"
            />

            <div className="hero-floating-card top-card">
              <div className="floating-icon floating-icon-green">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <span>EDI generado</span>
                <strong>Automatización marítima</strong>
              </div>
            </div>

            <div className="hero-floating-card bottom-card">
              <div className="floating-icon floating-icon-blue">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div>
                <span>IA activa</span>
                <strong>Procesamiento documental</strong>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* FEATURES */}
      <div className="features-section">
        <div className="features-header">
          <h2>¿Qué puedes hacer con ShipTranslate?</h2>
          <p>Una plataforma unificada para toda tu operación documental marítima</p>
        </div>

        <div className="features-grid">
          <div className="feature-card feature-card-blue">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h3>Lectura de PDF</h3>
            <p>Carga tus Bills of Lading en PDF y extrae automáticamente la información clave con ayuda de IA.</p>
          </div>

          <div className="feature-card feature-card-purple">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="16 16 12 12 8 16"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
            </div>
            <h3>Conversión a EDI</h3>
            <p>Genera mensajes IFTMCS completos y válidos desde los datos del PDF o edita los segmentos directamente.</p>
          </div>

          <div className="feature-card feature-card-teal">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <h3>Editor EDI visual</h3>
            <p>Visualiza y edita cada segmento EDI de forma amigable, sin necesidad de conocer la sintaxis técnica.</p>
          </div>

          <div className="feature-card feature-card-amber">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <h3>Historial de envíos</h3>
            <p>Accede a todos tus documentos procesados, filtra por naviera, BL o fecha y descarga los EDI generados.</p>
          </div>
        </div>
      </div>

      {/* ABOUT */}
      <div className="about-section">
        <div className="about-card">
          <div className="about-label">Sobre el proyecto</div>
          <h2>ShipTranslate</h2>
          <p>
            ShipTranslate nace como una solución enfocada en simplificar la
            gestión de mensajes EDI marítimos. La plataforma permite
            interpretar, visualizar y transformar información logística de
            forma más clara, rápida e intuitiva.
          </p>
          <p>
            Utilizando inteligencia artificial, el sistema es capaz de leer
            documentos PDF marítimos, extraer información relevante y generar
            estructuras EDI automáticamente, reduciendo errores operacionales y
            tiempos de procesamiento.
          </p>
          <div className="about-divider" />
          <div className="about-tags">
            <span className="about-tag">React + Vite</span>
            <span className="about-tag">Node.js + Express</span>
            <span className="about-tag">MongoDB</span>
            <span className="about-tag">IFTMCS EDI</span>
            <span className="about-tag">IA</span>
          </div>
        </div>
      </div>

    </section>
  );
}

export default Home;
