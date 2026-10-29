export default function Home() {
  return (
    <section className="space-y-4">
      <h1 className="font-[var(--font-display)] text-3xl">Home</h1>
      <p className="text-[var(--color-text-muted)]">
        Dashboard. Resumen, botón grande de empezar a entrenar, últimas sesiones.
      </p>
      <div className="rounded-[var(--radius-container)] bg-[var(--color-surface)] p-6">
        <p>Tarjeta de prueba sobre superficie elevada.</p>
      </div>
    </section>
  )
}
