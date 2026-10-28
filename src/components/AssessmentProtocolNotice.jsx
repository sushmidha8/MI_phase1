export default function AssessmentProtocolNotice({ protocol, submitting = false }) {
  if (!protocol.warning && !protocol.endReason) return null;
  const ended = Boolean(protocol.endReason);
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="protocol-title" style={{
      position: 'fixed', inset: 0, background: 'rgba(38,60,52,.88)', zIndex: 100000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ background: '#fff', color: '#263c34', borderRadius: 20, padding: 28, maxWidth: 450, width: '100%' }}>
        <h2 id="protocol-title" style={{ color: '#8c4740', marginBottom: 16 }}>{ended ? 'Assessment ended' : 'Test protocol warning'}</h2>
        <p style={{ lineHeight: 1.7, marginBottom: 16 }}>{protocol.endReason || protocol.warning.message}</p>
        {!ended && <p style={{ marginBottom: 20 }}>Window departures: {protocol.warning.count} of 3. The third departure submits your recorded answers.</p>}
        <button type="button" className="btn" autoFocus disabled={submitting}
          onClick={ended ? protocol.retry : protocol.resume}>
          {submitting ? 'Submitting recorded answers…' : ended ? 'Retry submission' : 'Return to assessment'}
        </button>
      </div>
    </div>
  );
}
