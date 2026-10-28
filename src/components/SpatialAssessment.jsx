import AssessmentIntro from './AssessmentIntro';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAssessmentProtocol from '../hooks/useAssessmentProtocol';
import AssessmentProtocolNotice from './AssessmentProtocolNotice';

const spatialData = [
  {
    video: '/video1.mp4',
    questions: [
      { text: "What shape did the spinning cloud mostly become?", weight: 1, options: ["A flat disc with a dense middle", "A long straight line", "A cube", "A small dot"], answer: 0 },
      { text: "How did the new Sun look?", weight: 2, options: ["A bright, hot ball", "A cold, dark rock", "A thin sheet of ice", "A tiny cloud"], answer: 0 },
      { text: "Where did colder, outer planets form?", weight: 3, options: ["Far from the center", "Right in the center", "Scattered above", "Inside the Sun"], answer: 0 }
    ]
  },
  {
    video: '/video2.mp4',
    questions: [
      { text: "Why do we sometimes only see part of the Moon?", weight: 1, options: ["Sun only lights up half", "Turns off night light", "Earth blocks all sunlight", "Changes size"], answer: 0 },
      { text: "Which phase is 'first quarter'?", weight: 2, options: ["Completely dark", "Half lit, quarter through", "Completely lit", "Small sliver"], answer: 1 },
      { text: "If the Moon is full, when will it rise?", weight: 3, options: ["Sun rises", "Noon", "Sun sets", "Midnight"], answer: 2 }
    ]
  },
  {
    video: '/video3.mp4',
    questions: [
      { text: "What is the formula for the volume of a pyramid?", weight: 1, options: ["Area base × height", "1/2 × Area × height", "1/3 × Area × height", "Area ÷ height"], answer: 2 },
      { text: "Surface area of a square-based pyramid?", weight: 3, options: ["B² + 2BL", "B² + 4BL", "4B² + 2BL", "1/3 B² + L"], answer: 0 },
      { text: "Area of an equilateral triangle base?", weight: 3, options: ["1/2 × B × height", "(3/4) B²", "(√3/4) B²", "B²"], answer: 2 }
    ]
  },
  {
    video: '/video4.mp4',
    questions: [
      { text: "Describe a hinge joint?", weight: 1, options: ["Ball in socket", "Bones glide slightly", "Moves forward/backward", "Rotates inside ring"], answer: 2 },
      { text: "Tissue covering joint from outside?", weight: 2, options: ["Ligament", "Cartilage", "Muscle", "Tendon"], answer: 1 },
      { text: "Which pair matches joint type with example?", weight: 2, options: ["Pivot — wrist", "Ball and socket — shoulder", "Gliding — elbow", "Hinge — hip"], answer: 1 }
    ]
  },
  {
    video: '/video5.mp4',
    questions: [
      { text: "Longest bone extending hip to knee?", weight: 1, options: ["Tibia", "Femur", "Humerus", "Fibula"], answer: 1 },
      { text: "Curved bones protecting heart?", weight: 2, options: ["Vertebral column", "Sternum", "Ribs", "Pelvic girdle"], answer: 2 },
      { text: "Lateral bone of forearm?", weight: 3, options: ["Ulna", "Humerus", "Radius", "Clavicle"], answer: 2 }
    ]
  }
];

const maxSpatialScore = spatialData.reduce((acc, v) => acc + v.questions.reduce((sum, q) => sum + q.weight, 0), 0);

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

export default function SpatialAssessment({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Test Started state (first display instructions before starting)
  const [testStarted, setTestStarted] = useState(false);

  // Proctored Timer & Anti-Cheat state

  // Initialize shuffled questions
  useEffect(() => {
    const shuffledData = spatialData.map(block => ({
      ...block,
      questions: shuffleArray(block.questions).map(q => ({
        ...q,
        options: shuffleArray(q.options.map((opt, i) => ({ text: opt, originalIndex: i })))
      }))
    }));
    setData(shuffledData);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalQuestions = data.reduce((acc, b) => acc + b.questions.length, 0);
  const answeredCount = Object.keys(answers).length;

  const handleSelect = (qIndexStr, valueIndex) => {
    setAnswers({ ...answers, [qIndexStr]: valueIndex });
  };

  const submissionLock = useRef(false);
  const calculateAndSubmit = async () => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setIsSubmitting(true);
    let score = 0;
    const answersToPost = [];

    data.forEach((block, bIdx) => {
      block.questions.forEach((q, qIdx) => {
        const key = `${bIdx}_${qIdx}`;
        if (answers[key] !== undefined) {
          const isCorrect = answers[key] === q.answer;
          if (isCorrect) score += q.weight;
          answersToPost.push({
            questionId: `spatial_${key}`,
            selectedOption: answers[key],
            isCorrect
          });
        }
      });
    });

    const normalizedScore = Math.round((score / maxSpatialScore) * 100);

    try {
      const res = await fetch('http://localhost:3001/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, type: 'Spatial', score: normalizedScore })
      });
      if (!res.ok) throw new Error("Could not save your assessment");
      const assessmentData = await res.json();

      for (const ans of answersToPost) {
        await fetch('http://localhost:3001/api/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assessmentId: assessmentData.id, ...ans })
        });
      }

      navigate('/results');
    } catch (err) {
      console.error(err);
      alert('Failed to save assessment');
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const protocol = useAssessmentProtocol({ active: testStarted && !isSubmitting, onForceSubmit: calculateAndSubmit, durationSeconds: 2700 });
  const { timeLeft, warningCount: tabWarnings } = protocol;

  // STEP 1: PRE-TEST INSTRUCTIONS SCREEN
  if (!testStarted) {
    return <AssessmentIntro type="Spatial" minutes={45} questions={15} onStart={() => setTestStarted(true)} />;
  }

  // STEP 2: ACTIVE TEST ASSESSMENT SCREEN
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
            Spatial Intelligence Test
          </h2>
        </div>

        {/* Timer Display */}
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

      {/* Proctoring Rules Alert */}
      <div style={{
        width: '100%', maxWidth: '800px', margin: '0 auto 1.5rem auto',
        background: 'rgba(155,81,75,0.1)', border: '1px solid rgba(155,81,75,0.4)',
        borderRadius: '12px', padding: '10px 16px', fontSize: '0.88rem', color: '#b17f70',
        display: 'flex', alignItems: 'center', gap: '10px'
      }}>
        <span></span>
        <div>
          <strong>Strict Test Rules:</strong> Do not switch tabs, copy text, or use external AI assistance. Tab or window departures are logged ({tabWarnings}/3 warnings).
        </div>
      </div>

      {/* Assessment Question Cards */}
      <div className="card" style={{ maxWidth: '800px' }}>
        {data.map((block, bIdx) => (
          <div key={bIdx} className="video-container">
            <video controls className="styled-player" src={block.video} />
            {block.questions.map((q, qIdx) => {
              const globalKey = `${bIdx}_${qIdx}`;
              return (
                <div key={qIdx} className="question-card">
                  <div className="weight-badge">Weight: {q.weight}</div>
                  <div className="question-text">{q.text}</div>
                  <div className="options-container">
                    {q.options.map((opt, oIdx) => (
                      <label key={oIdx} className={`option-label ${answers[globalKey] === opt.originalIndex ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          className="option-input"
                          name={`q_${globalKey}`}
                          onChange={() => handleSelect(globalKey, opt.originalIndex)}
                          checked={answers[globalKey] === opt.originalIndex}
                        />
                        <span className="option-text">{opt.text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Submit Action */}
      <div style={{ marginTop: '2rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <button
          className="btn primary-btn"
          onClick={() => {
            if (answeredCount < totalQuestions) {
              alert(`Please answer all questions before submitting. (${answeredCount}/${totalQuestions} answered)`);
              return;
            }
            calculateAndSubmit();
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting Assessment...' : 'Submit Final Assessment'}
        </button>
      </div>

      </div>
      <AssessmentProtocolNotice protocol={protocol} submitting={isSubmitting} />

    </div>
  );
}
