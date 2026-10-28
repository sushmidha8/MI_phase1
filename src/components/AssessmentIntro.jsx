import { ArrowRight, BookOpen, ChevronLeft, Clock3, Compass, Headphones, Music2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AssessmentRules from './AssessmentRules';

export default function AssessmentIntro({ type, minutes, questions, onStart }) {
  const navigate = useNavigate();
  const Icon = type === 'Spatial' ? Compass : type === 'Musical' ? Music2 : BookOpen;
  const description = type === 'Spatial' ? 'Watch the concept videos, then answer the questions using your visual understanding.' : type === 'Musical' ? 'Listen closely to the melodies and rhythms across three short audio sections.' : 'Explore words, vocabulary and verbal analogies at your own pace within the time limit.';
  return <div className="page assessment-intro">
    <button className="btn back-btn" data-assessment-navigation onClick={() => navigate('/dashboard')}><ChevronLeft size={15} /> Dashboard</button>
    <section className="assessment-welcome">
      <div className="assessment-intro-heading"><span className="card-icon"><Icon size={28} strokeWidth={1.2} /></span><span className="eyebrow">Discover your strengths</span><h1>{type} intelligence.</h1><p>{description}</p></div>
      <div className="assessment-facts"><span><Clock3 size={17} strokeWidth={1.4} /><strong>{minutes} minutes</strong><small>Time to complete</small></span><span><BookOpen size={17} strokeWidth={1.4} /><strong>{questions} questions</strong><small>Work independently</small></span></div>
    </section>
    <section className="card assessment-guidelines"><div className="assessment-guidelines-title"><ShieldCheck size={21} strokeWidth={1.3} /><h2>Before you begin</h2></div>
      {type === 'Musical' && <p className="audio-tip"><Headphones size={17} /> Use headphones and a comfortable listening volume.</p>}
      <AssessmentRules />
      <div className="assessment-start"><p>The timer starts when you begin.</p><button className="btn primary-btn" onClick={onStart}>I understand. Start assessment <ArrowRight size={16} /></button></div>
    </section>
  </div>;
}
