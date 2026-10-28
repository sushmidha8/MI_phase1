import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import SpatialAssessment from './components/SpatialAssessment';
import LinguisticAssessment from './components/LinguisticAssessment';
import MusicalAssessment from './components/MusicalAssessment';
import Results from './components/Results';
import TopicSelect from './components/TopicSelect';
import TextbookLearn from './components/TextbookLearn';
import Examination from './components/Examination';
import ExamResults from './components/ExamResults';
import { SiteHeader, SiteFooter } from './components/SiteChrome';
import './index.css';

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('phase1User') || 'null'); }
    catch { return null; }
  });
  const login = student => {
    sessionStorage.clear();
    sessionStorage.setItem('phase1User', JSON.stringify(student));
    setUser(student);
  };
  const logout = () => {
    sessionStorage.clear();
    setUser(null);
  };
  const guard = element => user ? element : <Navigate to="/" replace />;

  return (
    <Router>
      <SiteHeader user={user} onLogout={logout} />
      <main>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Auth onLogin={login} />} />
          <Route path="/dashboard" element={guard(<Dashboard user={user} />)} />
          <Route path="/spatial" element={guard(<SpatialAssessment user={user} />)} />
          <Route path="/linguistic" element={guard(<LinguisticAssessment user={user} />)} />
          <Route path="/musical" element={guard(<MusicalAssessment user={user} />)} />
          <Route path="/results" element={guard(<Results user={user} />)} />
          <Route path="/topic-select" element={guard(<TopicSelect user={user} />)} />
          <Route path="/textbook-learn" element={guard(<TextbookLearn />)} />
          <Route path="/exam/baseline" element={guard(<Examination />)} />
          <Route path="/exam-results/baseline" element={guard(<ExamResults />)} />
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
        </Routes>
      </main>
      <SiteFooter />
    </Router>
  );
}
