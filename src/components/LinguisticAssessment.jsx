import AssessmentIntro from './AssessmentIntro';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAssessmentProtocol from '../hooks/useAssessmentProtocol';
import AssessmentProtocolNotice from './AssessmentProtocolNotice';

const linguisticDataRaw = [
    { text: "Synonym: Enormous →", weight: 1, options: ["Heavy", "Huge", "Wide", "Tall"], answer: 1 },
    { text: "Synonym: Silent →", weight: 1, options: ["Quiet", "Loud", "Slow", "Scared"], answer: 0 },
    { text: "Synonym: Fragile →", weight: 2, options: ["Strong", "New", "Breakable", "Sharp"], answer: 2 },
    { text: "Synonym: Cautious →", weight: 2, options: ["Brave", "Careful", "Fast", "Angry"], answer: 1 },
    { text: "Antonym: Ancient →", weight: 1, options: ["Old", "Modern", "Big", "Early"], answer: 1 },
    { text: "Antonym: Generous →", weight: 2, options: ["Kind", "Greedy", "Rich", "Poor"], answer: 1 },
    { text: "Antonym: Permanent →", weight: 2, options: ["Forever", "Temporary", "Solid", "Long"], answer: 1 },
    { text: "Antonym: Optional →", weight: 3, options: ["Required", "Chosen", "Free", "Easy"], answer: 0 },
    { text: "Artist : Brush :: Writer :", weight: 1, options: ["Paper", "Pen", "Book", "Story"], answer: 1 },
    { text: "Chef : Knife :: Farmer :", weight: 2, options: ["Soil", "Crop", "Tractor", "Rain"], answer: 2 },
    { text: "Doctor : Stethoscope :: Astronomer :", weight: 2, options: ["Star", "Telescope", "Space", "Night"], answer: 1 },
    { text: "Carpenter : Saw :: Tailor :", weight: 2, options: ["Cloth", "Needle", "Suit", "Thread"], answer: 1 },
    { text: "Photographer : Camera :: Musician :", weight: 2, options: ["Song", "Instrument", "Stage", "Notes"], answer: 1 },
    { text: "Teacher : Chalkboard :: Pilot :", weight: 3, options: ["Plane", "Controls", "Sky", "Map"], answer: 0 },
    { text: "Hunger : Eat :: Thirst :", weight: 1, options: ["Water", "Drink", "Juice", "Throat"], answer: 1 },
    { text: "Rain : Mud :: Snow :", weight: 2, options: ["Cold", "Slush", "Winter", "White"], answer: 1 },
    { text: "Sun : Burn :: Ice :", weight: 2, options: ["Cold", "Freeze", "Water", "Melt"], answer: 3 },
    { text: "Joke : Laughter :: Sadness :", weight: 1, options: ["Happy", "Tears", "Face", "Sleep"], answer: 1 },
    { text: "Study : Grades :: Practice :", weight: 2, options: ["Game", "Skill", "Play", "Coach"], answer: 1 },
    { text: "Switch : Light :: Key :", weight: 2, options: ["Lock", "Unlock", "Metal", "Door"], answer: 0 },
    { text: "Which sentence uses 'Object' as a verb?", weight: 3, options: ["Mysterious object flew", "Must object to lawyer", "Main object of experiment", "Direct objects follow"], answer: 1 },
    { text: "'The river overflowed its bank' What does 'Bank' mean here?", weight: 3, options: ["Keep money", "Rising ground bordering water", "Row of similar objects", "Tilt aircraft"], answer: 1 },
    { text: "Which 'Critical' means essential?", weight: 3, options: ["Critical report", "Critical that you finish", "Critical condition"], answer: 1 },
    { text: "What does 'Solution' mean in 'test tube'?", weight: 3, options: ["Math answer", "Liquid mixture", "Act of solving"], answer: 1 },
    { text: "In 'weather the storm,' 'weather' means:", weight: 3, options: ["Temperature outside", "Wear away", "Endure difficult situation"], answer: 2 }
];

const maxLinguisticScore = linguisticDataRaw.reduce((acc, q) => acc + q.weight, 0);

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

export default function LinguisticAssessment({ user }) {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-test instructions & proctoring timer state
  const [testStarted, setTestStarted] = useState(false);

  useEffect(() => {
    const shuffledData = shuffleArray(linguisticDataRaw).map(q => ({
      ...q,
      options: shuffleArray(q.options.map((opt, i) => ({ text: opt, originalIndex: i })))
    }));
    setData(shuffledData);
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalQuestions = data.length;
  const answeredCount = Object.keys(answers).length;

  const handleSelect = (qIdx, valueIndex) => {
    setAnswers({ ...answers, [qIdx]: valueIndex });
  };

  const submissionLock = useRef(false);
  const calculateAndSubmit = async () => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setIsSubmitting(true);
    let score = 0;
    const answersToPost = [];

    data.forEach((q, qIdx) => {
      if (answers[qIdx] !== undefined) {
          const isCorrect = answers[qIdx] === q.answer;
          if (isCorrect) score += q.weight;
          answersToPost.push({
            questionId: `linguistic_${qIdx}`,
            selectedOption: answers[qIdx],
            isCorrect
          });
      }
    });

    const normalizedScore = Math.round((score / maxLinguisticScore) * 100);

    try {
        const res = await fetch('http://localhost:3001/api/assessments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, type: 'Linguistic', score: normalizedScore })
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

  const protocol = useAssessmentProtocol({ active: testStarted && !isSubmitting, onForceSubmit: calculateAndSubmit, durationSeconds: 1800 });
  const { timeLeft } = protocol;

  // STEP 1: PRE-TEST INSTRUCTIONS SCREEN
  if (!testStarted) {
    return <AssessmentIntro type="Linguistic" minutes={30} questions={25} onStart={() => setTestStarted(true)} />;
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
            Linguistic Intelligence Test
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

      <div className="card">
        {data.map((q, qIdx) => (
          <div key={qIdx} className="question-card">
            <div className="weight-badge">Weight: {q.weight}</div>
            <div className="question-text">{q.text}</div>
            <div className="options-container">
              {q.options.map((opt, oIdx) => (
                <label key={oIdx} className={`option-label ${answers[qIdx] === opt.originalIndex ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    className="option-input"
                    name={`q_${qIdx}`}
                    onChange={() => handleSelect(qIdx, opt.originalIndex)}
                    checked={answers[qIdx] === opt.originalIndex}
                  />
                  <span className="option-text">{opt.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

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
          {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
        </button>
      </div>

      </div>
      <AssessmentProtocolNotice protocol={protocol} submitting={isSubmitting} />

    </div>
  );
}
