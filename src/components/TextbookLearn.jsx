// src/components/TextbookLearn.jsx
// Phase 1: Concise Topic Overview & Brief Key Concepts before Baseline Examination (Test A).
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function TextbookLearn() {
  const navigate = useNavigate();
  const sessionId  = sessionStorage.getItem('currentSessionId');
  const topicKey   = sessionStorage.getItem('currentTopicKey');
  const subtopicKey = sessionStorage.getItem('currentSubtopicKey');
  const language   = sessionStorage.getItem('currentLanguage') || 'English';

  const [content, setContent]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [readConfirmed, setReadConfirmed] = useState(false);

  useEffect(() => {
    if (!sessionId || !topicKey) {
      navigate('/topic-select');
      return;
    }

    const fetchContent = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/textbook/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic_key: topicKey, subtopic_key: subtopicKey || null, language }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || `Status ${res.status}`);
        setContent(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [language, navigate, sessionId, topicKey, subtopicKey]);

  const handleStartTest = () => {
    sessionStorage.setItem('textbookReadSessionId', sessionId);
    navigate('/exam/baseline');
  };

  if (loading) {
    return (
      <div className="page reading-page" style={{ justifyContent: 'center', paddingTop: '4rem' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={44} color="#425f50" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
          <h2 className="glow-text">Loading Textbook Reading...</h2>
          <p style={{ color: '#697061' }}>Preparing your Class 6 Science passage...</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page reading-page" style={{ paddingTop: '2rem' }}>
        <button className="btn back-btn" onClick={() => navigate('/topic-select')}>← Back to Topic Selection</button>
        <div className="card" style={{ textAlign: 'center', color: '#9b514b', marginTop: '2rem', padding: '2rem' }}>
          <AlertCircle size={40} style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ fontSize: '1.2rem', fontWeight: 700 }}> Could not load textbook reading</p>
          <p style={{ color: '#697061', fontSize: '0.95rem' }}>{error}</p>
        </div>
      </div>
    );
  }

  const topicTitle = content?.title || sessionStorage.getItem('currentTopicTitle') || 'Science Topic';
  const briefPoints = content?.brief_points && content.brief_points.length > 0
    ? content.brief_points
    : [
        `Introduction to the fundamental scientific principles of ${topicTitle}.`,
        'Observation and classification of everyday physical phenomena and natural materials.',
        'Core scientific vocabulary, definitions, and real-world practical applications.',
        'Foundation concepts tested in the Class 6 Tamil Nadu State Board curriculum.'
      ];

  return (
    <div className="page reading-page" style={{ paddingTop: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <button className="btn back-btn" onClick={() => navigate('/topic-select')}>
        <ChevronLeft size={16} /> Back to Topic Selection
      </button>

      {/* Header */}
      <div style={{ width: '100%', marginBottom: '1.5rem', marginTop: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{
            background: '#eef1e8', color: '#425f50', padding: '4px 12px',
            borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700
          }}>
             Textbook reading
          </span>
          <span style={{
            background: language === 'English' ? '#eef1e7' : '#ede6d2',
            color: language === 'English' ? '#52715b' : '#8a7755',
            padding: '4px 12px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700
          }}>
            {language === 'English' ? ' English' : ' Tamil'}
          </span>
        </div>

        <h2 className="glow-text section-title" style={{ fontSize: '1.9rem', marginBottom: '0.3rem' }}>
          {topicTitle}
        </h2>
        <p style={{ fontSize: '0.88rem', color: '#697061', margin: 0 }}>
          {content?.source_note || 'Tamil Nadu State Board Class 6 Science'}
        </p>
      </div>

      {/* Compact Brief Card */}
      <div className="card" style={{
        borderTop: '2px solid #425f50',
        padding: '2rem',
        borderRadius: '10px',
        boxShadow: 'none',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem', borderBottom: '1px solid #eeefe7', paddingBottom: '0.8rem' }}>
          <span style={{ fontSize: '1.5rem' }}></span>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#263c34', fontWeight: '800' }}>
              Textbook Reading
            </h3>
          </div>
        </div>

        <section aria-labelledby="textbook-passage-title" lang={language === 'Tamil' ? 'ta' : 'en'}>
          <h3 id="textbook-passage-title" style={{ marginBottom: '1rem' }}>Read the textbook passage</h3>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, marginBottom: '1.5rem', overflowWrap: 'anywhere' }}>
            {content?.textbook_excerpt || content?.content}
          </div>
        </section>

        <h3 style={{ marginBottom: '1rem' }}>Key points</h3>
        {/* Concise Bullet Points */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.6rem' }}>
          {briefPoints.map((point, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                background: '#f5f4ee',
                border: '1px solid #dddfd4',
                borderRadius: '12px',
                padding: '0.9rem 1.1rem',
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: '#eef1e8',
                color: '#425f50', fontWeight: 800, fontSize: '0.8rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px'
              }}>
                {idx + 1}
              </div>
              <div style={{ color: '#35443e', fontSize: '0.94rem', lineHeight: '1.55' }}>
                {point}
              </div>
            </div>
          ))}
        </div>

        {content?.source_url && (
          <p style={{ color: '#697061', fontSize: '.85rem', marginBottom: '1.5rem' }}>
            <a href={content.source_url} target="_blank" rel="noreferrer">Read the original textbook pages </a>
          </p>
        )}


        {/* Confirmation Checkbox */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', userSelect: 'none',
          padding: '0.8rem', background: '#f5f4ee',
          borderRadius: '10px', border: '1px solid #dddfd4',
          marginBottom: '1.5rem'
        }}>
          <input
            type="checkbox"
            checked={readConfirmed}
            onChange={(e) => setReadConfirmed(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#425f50' }}
          />
          <span style={{ fontSize: '0.9rem', color: '#35443e', fontWeight: 600 }}>
            I have read the textbook passage for <strong>{topicTitle}</strong> and am ready for Test A.
          </span>
        </label>

        {/* Start Button */}
        <button
          className="btn"
          onClick={handleStartTest}
          disabled={!readConfirmed}
          style={{
            width: '100%',
            padding: '1rem',
            fontSize: '1.05rem',
            fontWeight: 800,
            background: readConfirmed
              ? '#425f50'
              : '#697061',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            cursor: readConfirmed ? 'pointer' : 'not-allowed',
            boxShadow: readConfirmed ? '0 6px 18px rgba(66,95,80,0.35)' : 'none',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          Start Baseline Test (Test A)  <ArrowRight size={18} />
        </button>
      </div>

      <div style={{ height: '2rem' }} />
    </div>
  );
}
