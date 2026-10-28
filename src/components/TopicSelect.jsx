// src/components/TopicSelect.jsx
// Step after Results: student selects a Class 6 Science topic and preferred language.
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TERM_COLORS = { 1: '#425f50', 2: '#52715b', 3: '#787565' };
const TERM_LABELS = { 1: 'Term 1', 2: 'Term 2', 3: 'Term 3' };

export default function TopicSelect({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [topics, setTopics]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [subtopics, setSubtopics] = useState([]);
  const [selectedSubtopic, setSelectedSubtopic] = useState(null);
  const [loadingSubtopics, setLoadingSubtopics] = useState(false);
  const [sectionError, setSectionError] = useState(null);
  const topicSectionRef = useRef(null);
  const chapterListRef = useRef(null);
  const [language, setLanguage]         = useState('English');
  const [dominantIntel, setDominantIntel] = useState(
    location.state?.dominantIntel ||
    sessionStorage.getItem('dominantIntelligence') ||
    'Spatial'
  );
  const [creating, setCreating]         = useState(false);

  // Fetch topics and user's dominant intelligence
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const userId = user?.id || 1;
        const [topicsRes, assessRes] = await Promise.all([
          fetch('http://localhost:8000/api/topics'),
          fetch(`http://localhost:3001/api/assessments/${userId}`, { cache: 'no-store' }),
        ]);
        if (!topicsRes.ok || !assessRes.ok) throw new Error('Could not load learning choices');
        const topicsData = await topicsRes.json();
        const assessData = await assessRes.json();
        if (!Array.isArray(assessData) || !['Spatial', 'Linguistic', 'Musical'].every(
          type => assessData.some(row => row.type === type && row.is_completed))) {
          navigate('/results', { replace: true });
          return;
        }

        setTopics(topicsData.topics || []);

        // Calculate dominant intelligence
        if (Array.isArray(assessData) && assessData.length) {
          const sorted = [...assessData].sort((a, b) => b.score - a.score);
          if (sorted[0]?.type) {
            setDominantIntel(sorted[0].type);
            sessionStorage.setItem('dominantIntelligence', sorted[0].type);
          }
        }
      } catch {
        setError('Failed to load topics. Is the backend running?');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user?.id, navigate]);

  useEffect(() => {
    if (!selectedTopic) return;
    topicSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const controller = new AbortController();
    fetch(`http://localhost:8000/api/chapters/${selectedTopic.key}/topics?language=${language}`, { signal: controller.signal })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Could not load chapter topics');
        return data;
      })
      .then(data => { setSubtopics(data.topics); setLoadingSubtopics(false); })
      .catch(err => {
        if (err.name !== 'AbortError') { setSectionError(err.message); setLoadingSubtopics(false); }
      });
    return () => controller.abort();
  }, [selectedTopic, language]);

  useEffect(() => {
    if (subtopics.length) topicSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [subtopics]);

  const chooseChapter = chapter => {
    if (selectedTopic?.key === chapter.key) return;
    setSelectedTopic(chapter);
    setSelectedSubtopic(null);
    setSubtopics([]);
    setSectionError(null);
    setLoadingSubtopics(true);
  };

  const chooseLanguage = lang => {
    if (language === lang) return;
    setLanguage(lang);
    setSelectedSubtopic(null);
    setSubtopics([]);
    setSectionError(null);
    setLoadingSubtopics(Boolean(selectedTopic));
  };

  const handleStart = async () => {
    if (!selectedTopic || !selectedSubtopic) return;
    const activeIntel = dominantIntel || sessionStorage.getItem('dominantIntelligence') || 'Spatial';
    setCreating(true);

    try {
      const res = await fetch('http://localhost:3001/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 1,
          topic: selectedSubtopic.title,
          topicKey: selectedTopic.key,
          subtopicKey: selectedSubtopic.key,
          language,
          dominantIntelligence: activeIntel,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create session');
      }

      const session = await res.json();
      // Clear stale exam results from any previous session so they cannot bleed into this new one
      sessionStorage.removeItem('examResult_baseline');
      sessionStorage.removeItem('textbookReadSessionId');
      // Store session ID in sessionStorage so it survives page navigation
      sessionStorage.setItem('currentSessionId', String(session.id));
      sessionStorage.setItem('currentTopicKey', selectedTopic.key);
      sessionStorage.setItem('currentSubtopicKey', selectedSubtopic.key);
      sessionStorage.setItem('currentChapterTitle', language === 'English' ? selectedTopic.titleEn : selectedTopic.titleTa);
      sessionStorage.setItem('currentTopicTitle', selectedSubtopic.title);
      sessionStorage.setItem('currentLanguage', language);
      sessionStorage.setItem('dominantIntelligence', activeIntel);

      navigate('/textbook-learn');
    } catch (e) {
      alert(e.message || 'Failed to start session. Please try again.');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <h2 className="glow-text">Loading Topics...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', color: '#9b514b' }}>
          <p> {error}</p>
          <button className="btn back-btn" onClick={() => navigate('/results')}>← Back to Results</button>
        </div>
      </div>
    );
  }

  // Group topics by term
  const grouped = topics.reduce((acc, t) => {
    if (!acc[t.term]) acc[t.term] = [];
    acc[t.term].push(t);
    return acc;
  }, {});

  const topicTitle = selectedSubtopic?.title;

  return (
    <div className="page topic-page" style={{ paddingTop: '2rem', maxWidth: '860px' }}>
      <button className="btn back-btn" onClick={() => navigate('/results')}>← Back to Results</button>

      <h2 className="glow-text section-title" style={{ fontSize: '2.2rem' }}>
         Choose a Chapter & Topic
      </h2>

      {/* Dominant Intelligence Banner */}
      {dominantIntel && (
        <div className="topic-notice" style={{
          background: '#eeefe5',
          border: '1px solid rgba(66,95,80,0.35)',
          borderRadius: '16px', padding: '1rem 1.5rem',
          marginBottom: '2rem', width: '100%', textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.05rem', color: '#425f50', fontWeight: 700 }}>
             Your Dominant Intelligence: <span style={{ color: '#787565' }}>{dominantIntel}</span>
          </div>
        </div>
      )}

      {/* Instruction banner */}
      <div className="topic-notice" style={{
        background: '#f1eee1', border: '1px solid #c6b993', borderRadius: '14px',
        padding: '1rem 1.4rem', marginBottom: '2rem', width: '100%'
      }}>
        <div style={{ fontWeight: 700, color: '#7a694c', marginBottom: '4px' }}> Important Instructions</div>
        <ul style={{ margin: 0, paddingLeft: '1.4rem', color: '#736247', fontSize: '0.93rem', lineHeight: '1.7' }}>
          <li>You will first read the textbook content, then take <strong>Test A</strong>.</li>
          <li>Test A has 5 multiple-choice questions and 4 descriptive questions, worth 25 marks in total.</li>
          <li>Phase 1 finishes after your Test A answers are submitted.</li>
        </ul>
      </div>

      {/* Language Selection */}
      <div style={{ width: '100%', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#263c34', marginBottom: '0.8rem', fontFamily: 'var(--font-display)' }}>
           Select Your Preferred Language
        </h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {['English', 'Tamil'].map(lang => (
            <button
              key={lang}
              aria-pressed={language === lang}
              onClick={() => chooseLanguage(lang)}
              style={{
                flex: 1, padding: '0.9rem', borderRadius: '12px', fontWeight: 700,
                fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s',
                border: language === lang ? '2px solid #425f50' : '2px solid #dddfd4',
                background: language === lang ? '#eef1e8' : 'white',
                color: language === lang ? '#425f50' : '#697061',
                boxShadow: language === lang ? '0 0 0 4px rgba(66,95,80,0.15)' : 'none',
              }}
            >
              {lang === 'English' ? ' English' : ' Tamil'}
            </button>
          ))}
        </div>
      </div>

      {/* Topic Cards by Term */}
      <div ref={chapterListRef} style={{ width: '100%', scrollMarginTop: 20 }}>
        <h3 style={{ fontSize: '1.1rem', color: '#263c34', marginBottom: '1.2rem', fontFamily: 'var(--font-display)' }}>
           1. Select a Class 6 Science Chapter
        </h3>
        <div className="chapter-grid">{[1, 2, 3].map(term => (
          <div key={term} className="chapter-card-list">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: `${TERM_COLORS[term]}18`, border: `1px solid ${TERM_COLORS[term]}40`,
              borderRadius: '10px', padding: '4px 14px', marginBottom: '0.8rem',
              color: TERM_COLORS[term], fontWeight: 700, fontSize: '0.88rem'
            }}>
               {TERM_LABELS[term]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {(grouped[term] || []).map(topic => {
                const title = language === 'English' ? topic.titleEn : topic.titleTa;
                const isSelected = selectedTopic?.key === topic.key;
                return (
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    key={topic.key}
                    onClick={() => chooseChapter(topic)}
                    style={{
                      padding: '1rem 1.3rem', borderRadius: '14px', cursor: 'pointer',
                      transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '1rem',
                      width: '100%', textAlign: 'left', fontFamily: 'inherit',
                      border: isSelected ? `2px solid ${TERM_COLORS[term]}` : '2px solid #dddfd4',
                      background: isSelected ? `${TERM_COLORS[term]}10` : 'white',
                      boxShadow: isSelected ? `0 0 0 3px ${TERM_COLORS[term]}25` : '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: `${TERM_COLORS[term]}20`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      color: TERM_COLORS[term], fontWeight: 800, fontSize: '0.95rem',
                      flexShrink: 0
                    }}>
                      {topic.chapter}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#263c34', fontSize: '1rem' }}>{title}</div>
                      <div style={{ fontSize: '0.82rem', color: '#697061', marginTop: '2px' }}>
                        Chapter {topic.chapter}
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ color: TERM_COLORS[term], fontSize: '1.3rem' }}>✓</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}</div>
      </div>

      {selectedTopic && (
        <section ref={topicSectionRef} aria-labelledby="chapter-topics-title" style={{ width: '100%', marginTop: '1.5rem', padding: '1.5rem', background: '#f5f4ee', border: '1px solid #c6cdbd', borderRadius: 16, scrollMarginTop: 20 }}>
          <h3 id="chapter-topics-title" style={{ color: '#263c34', marginBottom: 8 }}>
            2. Choose a topic in {language === 'English' ? selectedTopic.titleEn : selectedTopic.titleTa}
          </h3>
          <p style={{ color: '#697061', marginBottom: 16 }}>Select one textbook topic to study and practise.</p>
          <button type="button" className="btn back-btn" onClick={() => chapterListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Choose another chapter ↑</button>
          {loadingSubtopics && <p role="status">Reading chapter topics from your textbook…</p>}
          {sectionError && <p role="alert" style={{ color: '#8c4740' }}>{sectionError}</p>}
          {!loadingSubtopics && !sectionError && subtopics.length === 0 && <p>No readable topics were found in this chapter. Please choose another chapter.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
            {subtopics.map(section => (
              <button type="button" key={section.key} aria-pressed={selectedSubtopic?.key === section.key}
                onClick={() => setSelectedSubtopic(section)}
                style={{ padding: 16, textAlign: 'left', font: 'inherit', cursor: 'pointer', borderRadius: 12,
                  border: selectedSubtopic?.key === section.key ? '2px solid #425f50' : '2px solid #dddfd4',
                  background: selectedSubtopic?.key === section.key ? '#eef1e8' : '#fff', color: '#263c34' }}>
                <strong>{section.key} · {section.title}</strong>
                <span style={{ display: 'block', color: '#697061', fontSize: '.85rem', marginTop: 6 }}>Textbook PDF pages {section.page_start}–{section.page_end}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Start Button */}
      <div style={{ width: '100%', marginTop: '1.5rem', paddingBottom: '3rem' }}>
        {selectedSubtopic ? (
          <button
            className="btn primary-btn"
            onClick={handleStart}
            disabled={creating}
            style={{
              width: '100%', padding: '1.1rem', borderRadius: '14px', border: 'none',
              background: '#425f50',
              color: 'white', fontWeight: 800, fontSize: '1.1rem', cursor: 'pointer',
              boxShadow: 'none', transition: 'all 0.2s',
              opacity: creating ? 0.7 : 1,
            }}
          >
            {creating
              ? ' Setting up session...'
              : ` Read Textbook "${topicTitle}" in ${language} →`
            }
          </button>
        ) : (
          <div style={{
            textAlign: 'center', padding: '1rem', color: '#697061',
            border: '2px dashed #dddfd4', borderRadius: '14px', fontSize: '0.95rem'
          }}>
             {selectedTopic ? 'Choose a topic within your chapter to continue' : 'Select a chapter, then choose a topic to continue'}
          </div>
        )}
      </div>
    </div>
  );
}
