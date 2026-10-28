import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { cleanMathText } from '../utils/mathCleaner';
import useAssessmentProtocol from '../hooks/useAssessmentProtocol';
import AssessmentProtocolNotice from './AssessmentProtocolNotice';
import AssessmentRules from './AssessmentRules';

const PYTHON_URL = 'http://localhost:8000';
const NODE_URL   = 'http://localhost:3001';

export default function Examination() {
  const navigate = useNavigate();
  const phase = 'baseline';

  const sessionId  = sessionStorage.getItem('currentSessionId');
  const topicKey   = sessionStorage.getItem('currentTopicKey');
  const language   = sessionStorage.getItem('currentLanguage') || 'English';

  const [questions, setQuestions]   = useState([]);
  const [answers, setAnswers]       = useState({});  // { questionIndex: studentAnswerString }
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [topicTitle, setTopicTitle] = useState('');
  const [totalMarks, setTotalMarks] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [examStarted, setExamStarted] = useState(false);

  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!sessionId || !topicKey) { navigate('/topic-select'); return; }
    if (sessionStorage.getItem('textbookReadSessionId') !== sessionId) {
      navigate('/textbook-learn', { replace: true });
      return;
    }
    let active = true;
    const validBaseline = paper => Array.isArray(paper) && paper.length === 9
      && paper.filter(q => q.type === 'mcq').length === 5
      && paper.filter(q => q.type === 'descriptive').length === 4
      && paper.every(q => q.marks === (q.type === 'mcq' ? 1 : 5));
    const load = async () => {
      try {
        const sessionRes = await fetch(`${NODE_URL}/api/sessions/by-id/${sessionId}`);
        if (!sessionRes.ok) throw new Error('Could not load your learning session');
        const session = await sessionRes.json();
        const savedRes = await fetch(`${NODE_URL}/api/sessions/${sessionId}/questions`);
        if (!savedRes.ok) throw new Error('Could not retrieve examination questions');
        let paper = await savedRes.json();
        if (paper.length && !validBaseline(paper)) {
          throw new Error('This session uses an earlier exam format. Choose your topic again to start Test A with 5 MCQs and 4 descriptive questions.');
        }
        if (!paper.length) {
          if (!active) return;
          const generatedRes = await fetch(`${PYTHON_URL}/api/exam/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic_key: session.topic_key, subtopic_key: session.subtopic_key || null,
              language: session.language, topic_title: session.topic }),
          });
          const generated = await generatedRes.json();
          if (!generatedRes.ok) throw new Error(generated.detail || 'Question generation failed');
          if (!validBaseline(generated.questions)) throw new Error('The examination must contain 5 MCQs and 4 descriptive questions. Please try again.');
          if (!active) return;
          const saveRes = await fetch(`${NODE_URL}/api/sessions/${sessionId}/questions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: generated.questions }),
          });
          if (!saveRes.ok && saveRes.status !== 409) throw new Error('Could not save the examination. Please try again.');
          // Render the saved paper, including on a concurrent/repeated load.
          // Submitted answer IDs must refer to the saved paper.
          const confirmed = await fetch(`${NODE_URL}/api/sessions/${sessionId}/questions`);
          if (!confirmed.ok) throw new Error('Could not confirm saved questions');
          paper = await confirmed.json();
          if (!validBaseline(paper)) throw new Error('The saved paper uses an earlier format. Please choose your topic again.');
        }
        if (!paper.length) throw new Error('Please complete Test A first.');
        if (active) {
          setQuestions(paper);
          setTotalMarks(paper.reduce((sum, q) => sum + q.marks, 0));
          setTopicTitle(session.topic);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [navigate, sessionId, topicKey]);

  const handleAnswer = (qIndex, value) => {
    setAnswers(prev => ({ ...prev, [String(qIndex)]: value }));
  };

  const allAnswered = () => {
    return questions.every((_, i) => {
      const ans = answers[String(i)];
      return ans !== undefined && ans !== null && String(ans).trim() !== '';
    });
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      // Evaluate each answer
      let totalObtained = 0;
      const savedQuestions = await fetch(`${NODE_URL}/api/sessions/${sessionId}/questions`)
        .then(r => r.json()).catch(() => []);

      const answersPayload = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const studentAns = String(answers[String(i)] || '');
        const dbQuestion = savedQuestions[i] || null;
        const questionId = dbQuestion?.id || null;

        let evalRes;
        try {
          const evalResponse = await fetch(`${PYTHON_URL}/api/exam/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question_type: q.type,
              question_text: q.text,
              correct_answer: q.correctAnswer,
              student_answer: studentAns,
              marks: q.marks,
              language,
            }),
          });
          evalRes = await evalResponse.json();
        } catch {
          // Fallback: 0 marks
          evalRes = { marks_awarded: 0, feedback: 'Evaluation unavailable.' };
        }

        totalObtained += evalRes.marks_awarded || 0;
        if (questionId) {
          answersPayload.push({
            questionId,
            studentAnswer: studentAns,
            marksAwarded: evalRes.marks_awarded || 0,
            feedback: evalRes.feedback || '',
          });
        }
      }

      // Save attempt
      const attemptRes = await fetch(`${NODE_URL}/api/sessions/${sessionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          answers: answersPayload,
          totalMarksPossible: totalMarks,
          marksObtained: Math.round(totalObtained * 10) / 10,
        }),
      });

      if (!attemptRes.ok) {
        const errData = await attemptRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save attempt');
      }

      const attemptData = await attemptRes.json();

      // Store result for the results page
      sessionStorage.setItem(`examResult_${phase}`, JSON.stringify({
        sessionId,
        marksObtained: Math.round(totalObtained * 10) / 10,
        totalMarks,
        phase,
        attemptId: attemptData.attemptId,
        questionsCount: questions.length,
        timeTakenSecs: Math.floor((Date.now() - startTime) / 1000),
      }));

      navigate(`/exam-results/${phase}`);
    } catch (e) {
      alert('Submission error: ' + e.message);
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const protocol = useAssessmentProtocol({ active: examStarted && !loading && !submitting && questions.length > 0,
    onForceSubmit: handleSubmit, durationSeconds: 1800 });

  if (loading) {
    return (
      <div className="page" style={{ justifyContent: 'center', paddingTop: '4rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 className="glow-text">
            Preparing Test A...
          </h2>
          <p style={{ color: '#697061', maxWidth: '500px', margin: '0 auto' }}>
            Preparing your questions…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page" style={{ paddingTop: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', color: '#9b514b' }}>
          <h3>Examination Load Error</h3>
          <p style={{ color: '#697061' }}>{error}</p>
          <button className="btn back-btn" style={{ marginTop: '1.5rem' }}
            onClick={() => navigate('/topic-select')}>
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="page" style={{ paddingTop: '2rem', maxWidth: 760 }}>
        <div className="card" style={{ padding: '2rem' }}>
          <h1>Test A — Baseline Examination</h1>
          <h2 style={{ marginTop: 12 }}>{topicTitle}</h2>
          <p style={{ marginTop: 12 }}>{questions.length} questions · {totalMarks} marks · 30 minutes</p>
          <AssessmentRules />
          <button className="btn" onClick={() => { setStartTime(Date.now()); setExamStarted(true); }}>Start Test A</button>
        </div>
      </div>
    );
  }

  const mcqQuestions   = questions.filter(q => q.type === 'mcq');
  const descQuestions  = questions.filter(q => q.type === 'descriptive');
  const answeredCount  = Object.keys(answers).filter(k => String(answers[k]).trim() !== '').length;

  return (
    <div className="page" style={{ paddingTop: '1.5rem', maxWidth: '860px' }}>

      <AssessmentProtocolNotice protocol={protocol} submitting={submitting} />
      <div inert={Boolean(protocol.warning || protocol.endReason)} style={{ display: 'contents' }}>

      {/* Header */}
      <div style={{
        width: '100%', background: '#e9ede0',
        borderRadius: '10px', padding: '1.5rem',
        border: '2px solid #607b6b',
        marginBottom: '2rem', color: '#263c34',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
            color: '#607b6b', marginBottom: '4px' }}>
            Test A — Baseline Examination
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#263c34' }}>{topicTitle}</div>
          <div style={{ fontSize: '0.85rem', color: '#697061', marginTop: '6px' }}>
            Language: {language} · {questions.length} questions · {totalMarks} total marks
            <br />Time remaining: {Math.floor(protocol.timeLeft / 60)}:{String(protocol.timeLeft % 60).padStart(2, '0')} · Departures: {protocol.warningCount}/3
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.82rem', color: '#697061' }}>Answered</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900,
            color: answeredCount === questions.length ? '#7d9875' : '#857455' }}>
            {answeredCount}/{questions.length}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        background: '#f1eee1', border: '1px solid #c6b993', borderRadius: '12px',
        padding: '1rem 1.3rem', marginBottom: '2rem', width: '100%', fontSize: '0.9rem', color: '#736247'
      }}>
        <strong> Instructions:</strong> Answer all questions carefully.
        MCQs are worth 1 mark each.
        Descriptive questions are worth 5 marks each. Total marks: <strong>{totalMarks}</strong>.
      </div>

      {/* MCQ Section */}
      {mcqQuestions.length > 0 && (
        <div style={{ width: '100%', marginBottom: '2rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#263c34',
            borderBottom: '2px solid #425f50', paddingBottom: '8px', marginBottom: '1.2rem' }}>
            Section A — Multiple Choice Questions (1 mark each)
          </h3>
          {mcqQuestions.map((q, sectionIdx) => {
            const globalIdx = questions.indexOf(q);
            return (
              <div key={globalIdx} className="question-card" style={{ marginBottom: '1.2rem' }}>
                <div className="weight-badge">1 mark</div>
                <div className="question-text" style={{ fontSize: '1.05rem', paddingRight: '80px' }}>
                  Q{sectionIdx + 1}. {cleanMathText(q.text)}
                </div>
                <div className="options-container">
                  {(q.options || []).map((opt, oIdx) => (
                    <label key={oIdx}
                      className={`option-label ${answers[String(globalIdx)] === String(oIdx) ? 'selected' : ''}`}>
                      <input type="radio" className="option-input"
                        name={`q_${globalIdx}`}
                        onChange={() => handleAnswer(globalIdx, String(oIdx))}
                        checked={answers[String(globalIdx)] === String(oIdx)} />
                      <div className="custom-radio" />
                      <span className="option-text">
                        <span style={{ fontWeight: 700, marginRight: '6px' }}>
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        {cleanMathText(opt)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Descriptive Section */}
      {descQuestions.length > 0 && (
        <div style={{ width: '100%', marginBottom: '2rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#263c34',
            borderBottom: '2px solid #787565', paddingBottom: '8px', marginBottom: '1.2rem' }}>
            Section B — Descriptive Questions (5 marks each)
          </h3>
          {descQuestions.map((q, sectionIdx) => {
            const globalIdx = questions.indexOf(q);
            return (
              <div key={globalIdx} className="question-card" style={{ marginBottom: '1.2rem' }}>
                <div className="weight-badge" style={{ background: '#f0eee5', color: '#787565', borderColor: '#d3ceb9' }}>
                  5 marks
                </div>
                <div className="question-text" style={{ fontSize: '1.05rem', paddingRight: '80px' }}>
                  Q{mcqQuestions.length + sectionIdx + 1}. {cleanMathText(q.text)}
                </div>
                <textarea
                  placeholder="Write a detailed answer (1-2 paragraphs with examples)..."
                  value={answers[String(globalIdx)] || ''}
                  onChange={e => handleAnswer(globalIdx, e.target.value)}
                  rows={8}
                  style={{
                    width: '100%', padding: '0.9rem', borderRadius: '10px',
                    border: '1.5px solid #dddfd4',
                    fontSize: '1rem', outline: 'none', resize: 'vertical', color: '#35443e',
                    background: '#f5f4ee', lineHeight: '1.7',
                    fontFamily: language === 'Tamil' ? "'Noto Sans Tamil', sans-serif" : 'inherit'
                  }}
                  onFocus={e => e.target.style.borderColor = '#787565'}
                  onBlur={e => e.target.style.borderColor = '#dddfd4'}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Submit */}
      <div style={{ width: '100%', marginBottom: '3rem' }}>
        {!allAnswered() && (
          <div style={{
            background: '#f5eeea', border: '1px solid #dbc3b7', borderRadius: '10px',
            padding: '0.8rem 1.2rem', marginBottom: '1rem', color: '#8c4740', fontSize: '0.9rem'
          }}>
             Please answer all {questions.length} questions before submitting.
            ({answeredCount}/{questions.length} answered)
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={submitting || !allAnswered()}
          className="btn primary-btn"
          style={{
            width: '100%', fontSize: '1.1rem',
            background: submitting ? '#697061' : '#425f50',
            opacity: (!allAnswered() && !submitting) ? 0.5 : 1,
            cursor: (!allAnswered() && !submitting) ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting
            ? ' Evaluating answers and saving results...'
            : `Submit Test A — ${totalMarks} Total Marks`
          }
        </button>
      </div>
      </div>
    </div>
  );
}
