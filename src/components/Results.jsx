// src/components/Results.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Results({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState({ Spatial: 0, Linguistic: 0, Musical: 0 });
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3001/api/assessments/${user.id}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('Could not load your intelligence profile.');
        return res.json();
      })
      .then(rows => {
        const scores = { Spatial: 0, Linguistic: 0, Musical: 0 };
        if (Array.isArray(rows)) {
          rows.forEach(r => {
            if (scores[r.type] !== undefined) scores[r.type] = r.score;
          });
        }
        setData(scores);
        setCompleted(Array.isArray(rows) ? rows.filter(r => r.is_completed).map(r => r.type) : []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user.id]);

  if (loading) return <div className="page"><h2 className="glow-text">Loading Analysis...</h2></div>;
  if (error) return <div className="page"><p role="alert">{error}</p><button className="btn" onClick={() => navigate('/dashboard')}>Back to dashboard</button></div>;
  if (!['Spatial', 'Linguistic', 'Musical'].every(type => completed.includes(type))) {
    return <div className="page"><div className="card">
      <h1>Complete your intelligence profile</h1>
      <p>{completed.length} of 3 assessments completed. Complete Spatial, Linguistic and Musical assessments to see your dominant intelligence and choose a topic.</p>
      <button className="btn" onClick={() => navigate('/dashboard')}>Continue assessments</button>
    </div></div>;
  }

  const intelligences = [
    { name: 'Spatial',    score: data.Spatial,    insights: "You excel at visualizing the world in 3D. You likely enjoy puzzles, maps, and designing things." },
    { name: 'Linguistic', score: data.Linguistic,   insights: "You have a strong affinity for words, reading, and storytelling. Communication is your forte." },
    { name: 'Musical',   score: data.Musical,         insights: "You have a deep connection with rhythm and sound. Music often guides your thoughts and emotions." }
  ];
  intelligences.sort((a, b) => b.score - a.score);
  const dominant = intelligences[0];

  return (
    <div className="page" id="page-results" style={{ paddingTop: '2rem' }}>
      <div style={{ width: '100%', display: 'flex' }}>
        <button className="btn back-btn" onClick={() => navigate('/dashboard')}>← Dashboard</button>
      </div>
      <h2 className="glow-text section-title">Your Intelligence Profile</h2>

      {/* Primary dominant card */}
      <div className="main-result-card card mt-4"
        style={{ textAlign: 'center', position: 'relative', borderTop: '2px solid var(--primary-color)' }}>
        <h3 className="result-rank-badge"
          style={{ background: 'var(--primary-color)', color: 'white', padding: '0.5rem 1.5rem',
            borderRadius: '10px', display: 'inline-block', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
          PRIMARY DOMINANT
        </h3>
        <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', color: '#263c34', marginBottom: '0.5rem', fontWeight: '800' }}>
          {dominant.name}
        </div>
        <div className="result-score" style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--primary-color)' }}>
          {dominant.score}%
        </div>
        <p className="mt-4" style={{ fontStyle: 'italic', color: 'var(--text-main)', maxWidth: '600px', margin: '1.5rem auto' }}>
          {dominant.insights}
        </p>
      </div>

      {/* Secondary & Third */}
      <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '2rem' }}>
        <div className="card text-center" style={{ flex: 1, padding: '2rem', borderTop: '2px solid #697061' }}>
          <h4 style={{ color: '#697061', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Secondary Dominant
          </h4>
          <div style={{ fontSize: '1.8rem', fontFamily: 'var(--font-display)', color: '#35443e', marginBottom: '0.5rem', fontWeight: '700' }}>
            {intelligences[1].name}
          </div>
          <div style={{ fontSize: '1.5rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
            {intelligences[1].score}%
          </div>
          <p className="mt-4" style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
            {intelligences[1].insights}
          </p>
        </div>
        <div className="card text-center" style={{ flex: 1, padding: '1.5rem' }}>
          <h4 className="result-rank-badge-secondary">3rd</h4>
          <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: '#35443e', marginBottom: '0.2rem' }}>
            {intelligences[2].name}
          </div>
          <div style={{ fontSize: '1.2rem', color: 'var(--primary-color)' }}>{intelligences[2].score}%</div>
          <p className="mt-4" style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {intelligences[2].insights}
          </p>
        </div>
      </div>

      {/* Continue to textbook reading and Test A. */}
      <div style={{
        width: '100%', marginTop: '2.5rem',
        background: '#eeefe5',
        border: '2px solid rgba(66,95,80,0.3)', borderRadius: '10px', padding: '2rem',
        textAlign: 'center',
      }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#263c34', marginBottom: '0.5rem' }}>
          Choose a topic
        </h3>
        <button
          onClick={() => {
            sessionStorage.setItem('dominantIntelligence', dominant.name);
            navigate('/topic-select', { state: { dominantIntel: dominant.name } });
          }}
          style={{
            background: '#425f50',
            color: 'white', border: 'none', padding: '1rem 2.2rem',
            borderRadius: '14px', fontSize: '1.05rem', fontWeight: 800,
            cursor: 'pointer', boxShadow: 'none',
            transition: 'all 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'none'}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
