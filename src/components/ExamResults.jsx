import { useNavigate } from 'react-router-dom';

export default function ExamResults() {
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('currentSessionId');
  let result;
  try { result = JSON.parse(sessionStorage.getItem('examResult_baseline') || 'null'); }
  catch { result = null; }

  if (!result || String(result.sessionId) !== sessionId) {
    return <div className="page"><div className="card">
      <h1>No Test A submission found</h1>
      <p>Choose a topic and complete its textbook reading before taking Test A.</p>
      <button className="btn" onClick={() => navigate('/topic-select')}>Choose a topic</button>
    </div></div>;
  }

  return <div className="page" style={{ maxWidth: 760, paddingTop: '2rem' }}>
    <section className="card" style={{ width: '100%', padding: '2rem', textAlign: 'center' }}>
      <span className="eyebrow">Phase 1 complete</span>
      <h1>Test A submitted</h1>
      <p style={{ margin: '1rem 0' }}>Your answers for <strong>{sessionStorage.getItem('currentTopicTitle')}</strong> have been recorded.</p>
      <p>{result.questionsCount} questions · {result.totalMarks} marks · {sessionStorage.getItem('currentLanguage')}</p>
      <p style={{ margin: '1rem 0' }}>You have completed the intelligence profile, textbook reading and Test A.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        <button className="btn" onClick={() => navigate('/results')}>View intelligence profile</button>
        <button className="btn secondary-btn" onClick={() => navigate('/topic-select')}>Choose another topic</button>
      </div>
    </section>
  </div>;
}
