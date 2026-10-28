import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, Compass, Music2 } from 'lucide-react';

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState({
    Spatial: null,
    Linguistic: null,
    Musical: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3001/api/assessments/${user.id}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const comp = { Spatial: null, Linguistic: null, Musical: null };
        if (Array.isArray(data)) {
            data.forEach(assessment => {
                if (comp[assessment.type] !== undefined) comp[assessment.type] = assessment.score;
            });
        }
        setCompleted(comp);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);


  if (loading) return <div className="page"><p role="status">Preparing your dashboard…</p></div>;
  const completedCount = Object.values(completed).filter(score => score !== null).length;
  const modules = [
    { type: 'Spatial', route: '/spatial', icon: Compass, description: 'Explore how you think in shapes, pictures and space.', detail: '5 videos · 15 questions' },
    { type: 'Linguistic', route: '/linguistic', icon: BookOpen, description: 'Discover your connection with words and meaning.', detail: '25 questions' },
    { type: 'Musical', route: '/musical', icon: Music2, description: 'Find your feel for melody, sound and rhythm.', detail: '20 questions' },
  ];
  return (
    <div className="page dashboard-page" id="page-dashboard">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div><span className="eyebrow">Your personal learning space</span>
          <h1 id="dashboard-title">A little discovery.<br />A world of possibility.</h1>
          <p>Welcome, {user.username}. Start with three simple assessments to discover the way you learn best.</p>
        </div>
        <div className="progress-seal" aria-label={`${completedCount} of 3 assessments completed`}><strong>{completedCount}<span> / 3</span></strong><span>Assessments complete</span></div>
      </section>
      <div className="section-heading"><div><h2>Discover your strengths</h2><p>Select an intelligence module to begin your assessment.</p></div><span className="small-label">01 — DISCOVER</span></div>
      <div className="module-grid">
        {modules.map((module, index) => {
          const done = completed[module.type] !== null;
          const Icon = module.icon;
          return <button type="button" key={module.type} disabled={done} className={`interactive-card module-card${done ? ' completed' : ''}`} onClick={() => navigate(module.route)}>
            <div className="module-top"><span className="card-icon"><Icon size={26} strokeWidth={1.25} /></span><span className="module-index">0{index + 1}</span></div>
            <h3>{module.type}</h3><p>{module.description}</p>
            <div className="module-bottom"><span>{done ? `Completed · ${completed[module.type]}%` : module.detail}</span>{done ? <Check size={17} /> : <ArrowRight size={17} />}</div>
          </button>;
        })}
      </div>
      <section className="dashboard-summary"><div><h3>Your strengths, brought together.</h3><p>See your intelligence profile, then choose a Science topic to read before Test A.</p></div><button className="btn secondary-btn" onClick={() => navigate('/results')}>View my progress <ArrowRight size={16} /></button></section>
      <div className="journey-strip" aria-label="Your learning journey"><span><b>1</b> Discover your strengths</span><span><b>2</b> Choose a topic</span><span><b>3</b> Read the textbook</span><span><b>4</b> Complete Test A</span></div>
    </div>
  );
}
