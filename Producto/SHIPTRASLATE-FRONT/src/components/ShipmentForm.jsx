import { useState } from 'react';

function ShipmentForm({ onSave }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [client, setClient] = useState('');
  const [weight, setWeight] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    onSave({ origin, destination, client, weight: Number(weight) });
    setOrigin('');
    setDestination('');
    setClient('');
    setWeight('');
  }

  return (
    <section className="form-card">
      <h2>Nuevo envío</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Origen
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} required />
        </label>
        <label>
          Destino
          <input value={destination} onChange={(e) => setDestination(e.target.value)} required />
        </label>
        <label>
          Cliente
          <input value={client} onChange={(e) => setClient(e.target.value)} required />
        </label>
        <label>
          Peso (kg)
          <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} min="0" />
        </label>
        <button type="submit">Guardar envío</button>
      </form>
    </section>
  );
}

export default ShipmentForm;
