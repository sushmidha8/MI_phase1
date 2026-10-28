import AssessmentIntro from './AssessmentIntro';
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAssessmentProtocol from '../hooks/useAssessmentProtocol';
import AssessmentProtocolNotice from './AssessmentProtocolNotice';

const DELAYED_AUDIO = ["Delay1.mp3", "d10.mp3", "d13.mp3", "d14(2).mp3", "d16.mp3", "d19.mp3", "d3.mp3", "d6.mp3", "d7.mp3", "delay2.mp3"];
const NOT_DELAYED_AUDIO = ["12d.mp3", "d11.mp3", "d14.mp3", "d18.mp3", "d4.mp3", "d8.mp3", "do.mp3"];

const SAME_AUDIO = ["10t questions.mp3.mpeg", "11st questions.mp3.mpeg", "13t questions.mp3.mpeg", "14t questions.mp3.mpeg", "16t questions.mp3.mpeg", "17t questions.mpeg", "1st questions (SAME).mpeg", "3rt questions (SAME).mpeg", "4tht questions.mp3.mpeg", "6tt questions.mp3.mpeg", "7st questions.mp3.mpeg", "9st questions.mp3.mpeg"];
const NOT_SAME_AUDIO = ["12st questions.mp3.mpeg", "15st questions.mp3.mpeg", "2st questions (NOT SAME).mpeg", "5th questions.mp3.mpeg", "8th questions.mp3.mpeg"];

const FIRST_BEEP = ["t11.mp3", "t3.mp3", "t5.mp3", "t7.mp3", "t8.mp3"];
const SECOND_BEEP = ["t10.mp3", "t12.mp3", "t2o.mp3", "t4.mp3", "t6.mp3", "t8(2).mp3", "test4 beat.mp3"];

export default function MusicalAssessment({ user }) {
  const navigate = useNavigate();

  // Pre-test instructions & timer state
  const [testStarted, setTestStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLock = useRef(false);

  // 0: S1 Intro, 1: S1 Ex1, 2: S1 Ex2, 3: S1 Test
  // 4: S2 Intro, 5: S2 Ex1, 6: S2 Ex2, 7: S2 Test
  // 8: S3 Intro, 9: S3 Ex1, 10: S3 Ex2, 11: S3 Test
  // 12: Final Compute
  const [step, setStep] = useState(0);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const [exampleAnswer, setExampleAnswer] = useState(null);
  const [, setAudioEnded] = useState(false);

  const [sec1Questions, setSec1Questions] = useState([]);
  const [currentQ1, setCurrentQ1] = useState(0);
  const [score1, setScore1] = useState(0);

  const [sec2Questions, setSec2Questions] = useState([]);
  const [currentQ2, setCurrentQ2] = useState(0);
  const [score2, setScore2] = useState(0);

  const [sec3Questions, setSec3Questions] = useState([]);
  const [currentQ3, setCurrentQ3] = useState(0);
  const [score3, setScore3] = useState(0);

  const startSection1 = () => {
    const shuffledDelayed = [...DELAYED_AUDIO].sort(() => 0.5 - Math.random()).slice(0, 4);
    const shuffledNotDelayed = [...NOT_DELAYED_AUDIO].sort(() => 0.5 - Math.random()).slice(0, 4);
    const questions = [...shuffledDelayed.map(f => ({ file: `/musical/delayed/${f}`, hasDelay: true })), ...shuffledNotDelayed.map(f => ({ file: `/musical/not_delayed/${f}`, hasDelay: false }))].sort(() => 0.5 - Math.random());
    setSec1Questions(questions); setStep(3); setCurrentQ1(0); setScore1(0); setExampleAnswer(null); setAudioEnded(false);
  };

  const startSection2 = () => {
    const shuffledSame = [...SAME_AUDIO].sort(() => 0.5 - Math.random()).slice(0, 4);
    const shuffledNotSame = [...NOT_SAME_AUDIO].sort(() => 0.5 - Math.random()).slice(0, 3);
    const questions = [...shuffledSame.map(f => ({ file: `/musical/same/${f}`, isSame: true })), ...shuffledNotSame.map(f => ({ file: `/musical/notsame/${f}`, isSame: false }))].sort(() => 0.5 - Math.random());
    setSec2Questions(questions); setStep(7); setCurrentQ2(0); setScore2(0); setExampleAnswer(null); setAudioEnded(false);
  };

  const startSection3 = () => {
    const shuffledFirst = [...FIRST_BEEP].sort(() => 0.5 - Math.random()).slice(0, 3);
    const shuffledSecond = [...SECOND_BEEP].sort(() => 0.5 - Math.random()).slice(0, 2);
    const questions = [...shuffledFirst.map(f => ({ file: `/musical/first/${f}`, target: 'First' })), ...shuffledSecond.map(f => ({ file: `/musical/second/${f}`, target: 'Second' }))].sort(() => 0.5 - Math.random());
    setSec3Questions(questions); setStep(11); setCurrentQ3(0); setScore3(0); setExampleAnswer(null); setAudioEnded(false);
  };

  // STEP 1: PRE-TEST INSTRUCTIONS SCREEN
  const submitAssessment = async () => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setIsSubmitting(true);
    try {
      const finalScore = Math.round(((score1 + score2 + score3) / 20) * 100);
      const response = await fetch('http://localhost:3001/api/assessments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, type: 'Musical', score: finalScore }),
      });
      if (!response.ok) throw new Error('Could not save your assessment');
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      submissionLock.current = false;
      setIsSubmitting(false);
      alert('Failed to save your assessment. Please retry submission.');
    }
  };
  const protocol = useAssessmentProtocol({ active: testStarted && step < 12 && !isSubmitting, onForceSubmit: submitAssessment, durationSeconds: 1800 });
  const { timeLeft } = protocol;

  if (!testStarted) {
    return <AssessmentIntro type="Musical" minutes={30} questions={20} onStart={() => setTestStarted(true)} />;
  }

  return (
    <div className="page" style={{ paddingTop: '1.5rem', userSelect: 'none' }}>

      <div inert={Boolean(protocol.warning || protocol.endReason)} style={{ display: 'contents' }}>
      {/* Proctored Header & Timer Bar */}
      <div style={{
        width: '100%', maxWidth: '800px', margin: '0 auto 1.5rem auto',
        background: '#e9ede0',
        border: '1px solid #cbd5bf', borderRadius: '10px', padding: '1rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: 'none'
      }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: '#607b6b', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
             PROCTORED ASSESSMENT MODE
          </span>
          <h2 style={{ fontSize: '1.3rem', color: '#263c34', margin: '2px 0 0 0', fontWeight: '800' }}>
            Musical Intelligence Test
          </h2>
        </div>

        <div style={{
          background: timeLeft < 120 ? 'rgba(155,81,75,0.2)' : 'rgba(96,123,107,0.15)',
          border: `1px solid ${timeLeft < 120 ? '#9b514b' : '#607b6b'}`,
          borderRadius: '12px', padding: '8px 16px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.75rem', color: timeLeft < 120 ? '#9b514b' : '#697061', fontWeight: 'bold' }}>TIME REMAINING</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: timeLeft < 120 ? '#9b514b' : '#607b6b', fontFamily: 'monospace' }}>
             {formatTime(timeLeft)}
          </div>
        </div>
      </div>
      <button className="btn back-btn" data-assessment-navigation onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>

      {/* SECTION 1 - INTRO */}
      {step === 0 && (
        <div className="card text-center mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title">Musical Intelligence Assessment</h2>
          <div style={{ textAlign: 'left', lineHeight: '1.8', fontSize: '1.1rem', color: 'var(--text-main)', padding: '0 1rem' }}>
            <h3 style={{ color: 'var(--primary-color)', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Section 1: Melody Delays</h3>
            <p style={{ marginBottom: '1rem' }}>Welcome to the Musical Intelligence Assessment. This test contains a total of <strong>20 questions</strong> across three distinct sections.</p>
            <p style={{ marginBottom: '1.5rem' }}>In this first section, you will hear melodies that may contain an <strong>unusual delay</strong>.
            For each melody, you will be asked to answer:</p>
            <blockquote style={{ background: '#f5f4ee', padding: '1.5rem', borderLeft: '5px solid var(--primary-color)', fontStyle: 'italic', marginBottom: '1.5rem', borderRadius: '8px', fontSize: '1.2rem', fontWeight: '500', color: '#263c34' }}>
              "Do you think this melody contains an unusual delay?"
            </blockquote>
            <p>We will provide two practice examples before starting the 8-question test for this section. First, a melody that does <strong>not</strong> contain a delay. Then, a melody that <strong>does</strong>.</p>
          </div>
          <button className="btn primary-btn mt-5" onClick={() => setStep(1)} style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}>Continue to Examples</button>
        </div>
      )}

      {/* SECTION 1 - EX1 */}
      {step === 1 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 1: Practice Example 1 (Not Delayed)</h2>
          <div style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '2rem' }}>
            <p>Listen below. Because this is an example that <strong>does not</strong> contain an unusual delay, you should answer "No".</p>
          </div>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio id="s1-ex1" controls className="styled-player" src="/musical/not_delayed/d18.mp3" style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Do you think this melody contains an unusual delay?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'Yes' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Yes')} checked={exampleAnswer === 'Yes'} /><div className="custom-radio"></div><span className="option-text">Yes</span></label>
              <label className={`option-label ${exampleAnswer === 'No' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('No')} checked={exampleAnswer === 'No'} /><div className="custom-radio"></div><span className="option-text">No</span></label>
            </div>
            {exampleAnswer === 'Yes' && (
                <div style={{ padding: '1.5rem', background: '#f5eeea', borderRadius: '12px', marginTop: '1.5rem', border: '1px solid #dbc3b7', textAlign: 'center' }}>
                    <p style={{ color: 'var(--error-color)', fontWeight: '600', marginBottom: '1.5rem' }}>Remember, this example does <strong>not</strong> have a delay.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button className="btn secondary-btn" onClick={() => { setExampleAnswer(null); const p = document.getElementById('s1-ex1'); if(p) { p.currentTime=0; p.play(); } }}>Retry Example</button>
                        <button className="btn back-btn" style={{ margin: 0 }} onClick={() => { setStep(2); setExampleAnswer(null); setAudioEnded(false); }}>Skip</button>
                    </div>
                </div>
            )}
            {exampleAnswer === 'No' && <div style={{ color: 'var(--success-color)', padding: '1rem', background: '#eef1e7', borderRadius: '12px', marginTop: '1.5rem', fontWeight: '600', textAlign: 'center', border: '1px solid #c8d3bb' }}>Correct! Proceed to next.</div>}
          </div>
          {exampleAnswer === 'No' && <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}><button className="btn primary-btn" onClick={() => { setStep(2); setExampleAnswer(null); setAudioEnded(false); }}>Continue to Next Example</button></div>}
        </div>
      )}

      {/* SECTION 1 - EX2 */}
      {step === 2 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 1: Practice Example 2 (Delayed)</h2>
          <div style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '2rem' }}>
            <p>Listen below. Because this second example <strong>does</strong> contain an unusual delay, you should answer "Yes".</p>
          </div>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio id="s1-ex2" controls className="styled-player" src="/musical/delayed/d3.mp3" style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Do you think this melody contains an unusual delay?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'Yes' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Yes')} checked={exampleAnswer === 'Yes'} /><div className="custom-radio"></div><span className="option-text">Yes</span></label>
              <label className={`option-label ${exampleAnswer === 'No' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('No')} checked={exampleAnswer === 'No'} /><div className="custom-radio"></div><span className="option-text">No</span></label>
            </div>
            {exampleAnswer === 'No' && (
                <div style={{ padding: '1.5rem', background: '#f5eeea', borderRadius: '12px', marginTop: '1.5rem', border: '1px solid #dbc3b7', textAlign: 'center' }}>
                    <p style={{ color: 'var(--error-color)', fontWeight: '600', marginBottom: '1.5rem' }}>Remember, this example <strong>does</strong> have a delay.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button className="btn secondary-btn" onClick={() => { setExampleAnswer(null); const p = document.getElementById('s1-ex2'); if(p) { p.currentTime=0; p.play(); } }}>Retry Example</button>
                        <button className="btn back-btn" style={{ margin: 0 }} onClick={startSection1}>Skip to Real Test</button>
                    </div>
                </div>
            )}
            {exampleAnswer === 'Yes' && <div style={{ color: 'var(--success-color)', padding: '1rem', background: '#eef1e7', borderRadius: '12px', marginTop: '1.5rem', fontWeight: '600', textAlign: 'center', border: '1px solid #c8d3bb' }}>Correct! Proceed to real test.</div>}
          </div>
          {exampleAnswer === 'Yes' && <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}><button className="btn primary-btn" onClick={startSection1}>Continue to Real Test</button></div>}
        </div>
      )}

      {/* SECTION 1 - REAL TEST */}
      {step === 3 && sec1Questions.length > 0 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 1: Question {currentQ1 + 1} of 8</h2>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio key={sec1Questions[currentQ1].file} controls className="styled-player" src={sec1Questions[currentQ1].file} style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Do you think this melody contains an unusual delay?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'Yes' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Yes')} checked={exampleAnswer === 'Yes'} /><div className="custom-radio"></div><span className="option-text">Yes</span></label>
              <label className={`option-label ${exampleAnswer === 'No' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('No')} checked={exampleAnswer === 'No'} /><div className="custom-radio"></div><span className="option-text">No</span></label>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
            <button className="btn primary-btn" disabled={!exampleAnswer} onClick={() => {
                const q = sec1Questions[currentQ1];
                if ((exampleAnswer === 'Yes' && q.hasDelay) || (exampleAnswer === 'No' && !q.hasDelay)) setScore1(prev => prev + 1);
                if (currentQ1 < 7) { setCurrentQ1(prev => prev + 1); setExampleAnswer(null); setAudioEnded(false); }
                else { setStep(4); }
            }}>{currentQ1 < 7 ? 'Submit Answer & Next' : 'Finish Section 1'}</button>
          </div>
        </div>
      )}

      {/* SECTION 2 - INTRO */}
      {step === 4 && (
        <div className="card text-center mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title">Section 2: Same or Different Melodies</h2>
          <div style={{ textAlign: 'left', lineHeight: '1.8', fontSize: '1.1rem', color: 'var(--text-main)', padding: '0 1rem' }}>
            <p style={{ marginBottom: '1.5rem' }}>Excellent job completing Section 1! Your current score is saved (<strong>{score1}/8</strong>).</p>
            <p style={{ marginBottom: '1.5rem' }}>In <strong>Section 2</strong>, you will hear <u>two melodies played sequentially in a single audio file</u>. You need to carefully determine whether they are the same melodies, or if they are different.</p>
            <blockquote style={{ background: '#f5f4ee', padding: '1.5rem', borderLeft: '5px solid var(--primary-color)', fontStyle: 'italic', marginBottom: '1.5rem', borderRadius: '8px', fontSize: '1.2rem', fontWeight: '500', color: '#263c34' }}>
              "Are these two melodies the SAME or DIFFERENT?"
            </blockquote>
            <p>We will provide two practice examples before starting the 7-question test. First, an example of the <strong>Same</strong>. Then, an example of <strong>Different</strong>.</p>
          </div>
          <button className="btn primary-btn mt-5" onClick={() => { setStep(5); setExampleAnswer(null); setAudioEnded(false); }} style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}>Continue to Examples</button>
        </div>
      )}

      {/* SECTION 2 - EX1 */}
      {step === 5 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 2: Practice Example 1 (Same)</h2>
          <div style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '2rem' }}><p>Because this is the <strong>Same Melodies</strong> example, you should answer "Same".</p></div>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio id="s2-ex1" controls className="styled-player" src="/musical/same/4tht questions.mp3.mpeg" style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Are these two melodies the SAME or DIFFERENT?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'Same' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Same')} checked={exampleAnswer === 'Same'} /><div className="custom-radio"></div><span className="option-text">Same Melodies</span></label>
              <label className={`option-label ${exampleAnswer === 'Different' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Different')} checked={exampleAnswer === 'Different'} /><div className="custom-radio"></div><span className="option-text">Different / Not Same</span></label>
            </div>
            {exampleAnswer === 'Different' && (
                <div style={{ padding: '1.5rem', background: '#f5eeea', borderRadius: '12px', marginTop: '1.5rem', border: '1px solid #dbc3b7', textAlign: 'center' }}>
                    <p style={{ color: 'var(--error-color)', fontWeight: '600', marginBottom: '1.5rem' }}>Remember, this example contains the <strong>SAME</strong> melodies.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button className="btn secondary-btn" onClick={() => { setExampleAnswer(null); const p = document.getElementById('s2-ex1'); if(p) { p.currentTime=0; p.play(); } }}>Retry Example</button>
                        <button className="btn back-btn" style={{ margin: 0 }} onClick={() => { setStep(6); setExampleAnswer(null); setAudioEnded(false); }}>Skip to Next</button>
                    </div>
                </div>
            )}
            {exampleAnswer === 'Same' && <div style={{ color: 'var(--success-color)', padding: '1rem', background: '#eef1e7', borderRadius: '12px', marginTop: '1.5rem', fontWeight: '600', textAlign: 'center', border: '1px solid #c8d3bb' }}>Correct! You are ready to proceed.</div>}
          </div>
          {exampleAnswer === 'Same' && <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}><button className="btn primary-btn" onClick={() => { setStep(6); setExampleAnswer(null); setAudioEnded(false); }}>Continue to Next Example</button></div>}
        </div>
      )}

      {/* SECTION 2 - EX2 */}
      {step === 6 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 2: Practice Example 2 (Not Same)</h2>
          <div style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '2rem' }}><p>Because this is the <strong>Not Same Melodies</strong> example, you should answer "Different".</p></div>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio id="s2-ex2" controls className="styled-player" src="/musical/notsame/5th questions.mp3.mpeg" style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Are these two melodies the SAME or DIFFERENT?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'Same' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Same')} checked={exampleAnswer === 'Same'} /><div className="custom-radio"></div><span className="option-text">Same Melodies</span></label>
              <label className={`option-label ${exampleAnswer === 'Different' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Different')} checked={exampleAnswer === 'Different'} /><div className="custom-radio"></div><span className="option-text">Different / Not Same</span></label>
            </div>
            {exampleAnswer === 'Same' && (
                <div style={{ padding: '1.5rem', background: '#f5eeea', borderRadius: '12px', marginTop: '1.5rem', border: '1px solid #dbc3b7', textAlign: 'center' }}>
                    <p style={{ color: 'var(--error-color)', fontWeight: '600', marginBottom: '1.5rem' }}>Remember, these melodies are <strong>DIFFERENT</strong>.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button className="btn secondary-btn" onClick={() => { setExampleAnswer(null); const p = document.getElementById('s2-ex2'); if(p) { p.currentTime=0; p.play(); } }}>Retry Example</button>
                        <button className="btn back-btn" style={{ margin: 0 }} onClick={startSection2}>Skip to Real Test</button>
                    </div>
                </div>
            )}
            {exampleAnswer === 'Different' && <div style={{ color: 'var(--success-color)', padding: '1rem', background: '#eef1e7', borderRadius: '12px', marginTop: '1.5rem', fontWeight: '600', textAlign: 'center', border: '1px solid #c8d3bb' }}>Correct! Proceed to real test.</div>}
          </div>
          {exampleAnswer === 'Different' && <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}><button className="btn primary-btn" onClick={startSection2}>Continue to Real Test</button></div>}
        </div>
      )}

      {/* SECTION 2 - REAL TEST */}
      {step === 7 && sec2Questions.length > 0 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 2: Question {currentQ2 + 1} of 7</h2>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio key={sec2Questions[currentQ2].file} controls className="styled-player" src={sec2Questions[currentQ2].file} style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Are these two melodies the SAME or DIFFERENT?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'Same' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Same')} checked={exampleAnswer === 'Same'} /><div className="custom-radio"></div><span className="option-text">Same Melodies</span></label>
              <label className={`option-label ${exampleAnswer === 'Different' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Different')} checked={exampleAnswer === 'Different'} /><div className="custom-radio"></div><span className="option-text">Different / Not Same</span></label>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
            <button className="btn primary-btn" disabled={!exampleAnswer} onClick={() => {
                const q = sec2Questions[currentQ2];
                if ((exampleAnswer === 'Same' && q.isSame) || (exampleAnswer === 'Different' && !q.isSame)) setScore2(prev => prev + 1);
                if (currentQ2 < 6) { setCurrentQ2(prev => prev + 1); setExampleAnswer(null); setAudioEnded(false); }
                else { setStep(8); }
            }}>{currentQ2 < 6 ? 'Submit Answer & Next' : 'Finish Section 2'}</button>
          </div>
        </div>
      )}

      {/* SECTION 3 - INTRO */}
      {step === 8 && (
        <div className="card text-center mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title">Section 3: Identifying the Beat</h2>
          <div style={{ textAlign: 'left', lineHeight: '1.8', fontSize: '1.1rem', color: 'var(--text-main)', padding: '0 1rem' }}>
            <p style={{ marginBottom: '1.5rem' }}>Section 2 complete! Your combined score is tracking correctly (<strong>{score1 + score2}/15</strong>).</p>
            <p style={{ marginBottom: '1.5rem' }}>In this <strong>final section</strong>, you will hear a file containing two clips. Your task is to listen closely to both and decide which clip had beeps that were the <strong>most on the beat</strong>.</p>
            <blockquote style={{ background: '#f5f4ee', padding: '1.5rem', borderLeft: '5px solid var(--primary-color)', fontStyle: 'italic', marginBottom: '1.5rem', borderRadius: '8px', fontSize: '1.2rem', fontWeight: '500', color: '#263c34' }}>
              "Which clip had the better beeps on the beat?"
            </blockquote>
            <p>First, an example where the <strong>First</strong> clip is better, then an example where the <strong>Second</strong> clip is better. Finally, we'll dive into the final 5 questions to complete your 20-question test!</p>
          </div>
          <button className="btn primary-btn mt-5" onClick={() => { setStep(9); setExampleAnswer(null); setAudioEnded(false); }} style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}>Continue to Examples</button>
        </div>
      )}

      {/* SECTION 3 - EX1 (First) */}
      {step === 9 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 3: Practice Example 1 (First Beat is Better)</h2>
          <div style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '2rem' }}><p>In this file, the <strong>first</strong> clip has beeps that are more on the beat. You should answer "First Clip".</p></div>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio id="s3-ex1" controls className="styled-player" src="/musical/first/t11.mp3" style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Which clip had beeps that were the most on the beat?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'First' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('First')} checked={exampleAnswer === 'First'} /><div className="custom-radio"></div><span className="option-text">First Clip</span></label>
              <label className={`option-label ${exampleAnswer === 'Second' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Second')} checked={exampleAnswer === 'Second'} /><div className="custom-radio"></div><span className="option-text">Second Clip</span></label>
            </div>
            {exampleAnswer === 'Second' && (
                <div style={{ padding: '1.5rem', background: '#f5eeea', borderRadius: '12px', marginTop: '1.5rem', border: '1px solid #dbc3b7', textAlign: 'center' }}>
                    <p style={{ color: 'var(--error-color)', fontWeight: '600', marginBottom: '1.5rem' }}>Remember, the <strong>FIRST</strong> clip is better here.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button className="btn secondary-btn" onClick={() => { setExampleAnswer(null); const p=document.getElementById('s3-ex1'); if(p){p.currentTime=0; p.play();} }}>Retry Example</button>
                        <button className="btn back-btn" style={{ margin: 0 }} onClick={() => { setStep(10); setExampleAnswer(null); setAudioEnded(false); }}>Skip to Next</button>
                    </div>
                </div>
            )}
            {exampleAnswer === 'First' && <div style={{ color: 'var(--success-color)', padding: '1rem', background: '#eef1e7', borderRadius: '12px', marginTop: '1.5rem', fontWeight: '600', textAlign: 'center', border: '1px solid #c8d3bb' }}>Correct! Proceed to next.</div>}
          </div>
          {exampleAnswer === 'First' && <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}><button className="btn primary-btn" onClick={() => { setStep(10); setExampleAnswer(null); setAudioEnded(false); }}>Continue to Next Example</button></div>}
        </div>
      )}

      {/* SECTION 3 - EX2 (Second) */}
      {step === 10 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 3: Practice Example 2 (Second Beat is Better)</h2>
          <div style={{ textAlign: 'center', color: 'var(--text-main)', fontSize: '1.1rem', marginBottom: '2rem' }}><p>In this file, the <strong>second</strong> clip has beeps that are more on the beat. You should answer "Second Clip".</p></div>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio id="s3-ex2" controls className="styled-player" src="/musical/second/t10.mp3" style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Which clip had beeps that were the most on the beat?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'First' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('First')} checked={exampleAnswer === 'First'} /><div className="custom-radio"></div><span className="option-text">First Clip</span></label>
              <label className={`option-label ${exampleAnswer === 'Second' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Second')} checked={exampleAnswer === 'Second'} /><div className="custom-radio"></div><span className="option-text">Second Clip</span></label>
            </div>
            {exampleAnswer === 'First' && (
                <div style={{ padding: '1.5rem', background: '#f5eeea', borderRadius: '12px', marginTop: '1.5rem', border: '1px solid #dbc3b7', textAlign: 'center' }}>
                    <p style={{ color: 'var(--error-color)', fontWeight: '600', marginBottom: '1.5rem' }}>Remember, the <strong>SECOND</strong> clip is better here.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button className="btn secondary-btn" onClick={() => { setExampleAnswer(null); const p=document.getElementById('s3-ex2'); if(p){p.currentTime=0; p.play();} }}>Retry Example</button>
                        <button className="btn back-btn" style={{ margin: 0 }} onClick={startSection3}>Skip to Real Test</button>
                    </div>
                </div>
            )}
            {exampleAnswer === 'Second' && <div style={{ color: 'var(--success-color)', padding: '1rem', background: '#eef1e7', borderRadius: '12px', marginTop: '1.5rem', fontWeight: '600', textAlign: 'center', border: '1px solid #c8d3bb' }}>Correct! Proceed to real test.</div>}
          </div>
          {exampleAnswer === 'Second' && <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}><button className="btn primary-btn" onClick={startSection3}>Continue to Real Test</button></div>}
        </div>
      )}

      {/* SECTION 3 - REAL TEST */}
      {step === 11 && sec3Questions.length > 0 && (
        <div className="card mt-4" style={{ maxWidth: '800px' }}>
          <h2 className="glow-text section-title" style={{ textAlign: 'center' }}>Section 3: Question {currentQ3 + 1} of 5</h2>
          <div className="player-container" style={{ margin: '0 auto 2rem auto', background: '#f5f4ee', boxShadow: 'none', border: '2px dashed var(--card-border)' }}>
            <audio key={sec3Questions[currentQ3].file} controls className="styled-player" src={sec3Questions[currentQ3].file} style={{ width: '100%' }} onEnded={() => setAudioEnded(true)} onError={() => setAudioEnded(true)} />
          </div>
          <div className="question-card" style={{ background: '#f5f4ee' }}>
            <div className="question-text">Which clip had beeps that were the most on the beat?</div>
            <div className="options-container">
              <label className={`option-label ${exampleAnswer === 'First' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('First')} checked={exampleAnswer === 'First'} /><div className="custom-radio"></div><span className="option-text">First Clip</span></label>
              <label className={`option-label ${exampleAnswer === 'Second' ? 'selected' : ''}`}><input type="radio" className="option-input" onChange={() => setExampleAnswer('Second')} checked={exampleAnswer === 'Second'} /><div className="custom-radio"></div><span className="option-text">Second Clip</span></label>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem' }}>
            <button className="btn primary-btn" disabled={!exampleAnswer} onClick={() => {
                const q = sec3Questions[currentQ3];
                if (exampleAnswer === q.target) setScore3(prev => prev + 1);
                if (currentQ3 < 4) { setCurrentQ3(prev => prev + 1); setExampleAnswer(null); setAudioEnded(false); }
                else { setStep(12); }
            }}>{currentQ3 < 4 ? 'Submit Answer & Next' : 'Finish Assessment'}</button>
          </div>
        </div>
      )}

      {/* FINAL DASHBOARD COMPUTATION */}
      {step === 12 && (
         <div className="card mt-4 text-center">
            <h2 className="glow-text section-title" style={{ fontSize: '2.5rem' }}>Assessment Completed!</h2>
            <div style={{ background: '#f5f4ee', padding: '2rem', borderRadius: '12px', border: '1px solid var(--card-border)', marginBottom: '2rem' }}>
                 <p style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginTop: '0.5rem' }}>Section 1: {score1} / 8</p>
                 <p style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginTop: '0.5rem' }}>Section 2: {score2} / 7</p>
                 <p style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginTop: '0.5rem' }}>Section 3: {score3} / 5</p>

                 <div style={{ margin: '2rem 0', padding: '2rem 0', borderTop: '2px solid var(--card-border)', borderBottom: '2px solid var(--card-border)' }}>
                     <h3 style={{ color: 'var(--text-muted)', fontSize: '1.5rem', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>Your Total Musical Score</h3>
                     <div style={{ fontSize: '4rem', fontWeight: '900', color: 'var(--primary-color)' }}>
                         {Math.round(((score1 + score2 + score3) / 20) * 100)}%
                     </div>
                 </div>
            </div>

            <p className="mt-4 text-muted" style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>By finalizing, your musical intelligence score will be securely updated onto your Dashboard tracking profile.</p>
            <button className="btn primary-btn gold-hover mt-4" style={{ padding: '1rem 2rem', fontSize: '1.2rem', width: '100%' }} onClick={submitAssessment} disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Return to Dashboard'}</button>
         </div>
      )}

      </div>
      <AssessmentProtocolNotice protocol={protocol} submitting={isSubmitting} />

    </div>
  );
}
