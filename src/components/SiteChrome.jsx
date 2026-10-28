import { BookOpen, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function SiteHeader({ user, onLogout }) {
  const { pathname } = useLocation();
  const assessment = ['/spatial', '/linguistic', '/musical'].includes(pathname) || pathname.startsWith('/exam/');
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" to={user ? '/dashboard' : '/'} data-assessment-navigation aria-label="Multi Intelligence home">
          <span className="brand-symbol"><BookOpen size={23} strokeWidth={1.5} /></span>
          <span>Multi Intelligence<small>DISCOVER YOUR WAY TO LEARN</small></span>
        </Link>
        {user ? <>
          <nav className="site-nav" aria-label="Main navigation">
            <Link data-assessment-navigation to="/dashboard" aria-current={pathname === '/dashboard' || assessment ? 'page' : undefined}>Assessments</Link>
            <Link data-assessment-navigation to="/results" aria-current={pathname === '/results' ? 'page' : undefined}>My progress</Link>
            <Link data-assessment-navigation to="/topic-select" aria-current={pathname.includes('learn') || pathname === '/topic-select' ? 'page' : undefined}>Textbook & Test A</Link>
          </nav>
          <div className="site-account">
            <span className="account-avatar" aria-hidden="true">{user.username?.trim().charAt(0).toUpperCase() || 'S'}</span>
            <span className="account-name">{user.username}</span>
            <button className="sign-out" data-assessment-navigation onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </div>
        </> : <span className="header-tagline">A more personal way to learn.</span>}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return <footer className="site-footer"><span>Multi Intelligence</span><span>Thoughtful learning. Lasting understanding.</span><span>Class 6 · Science</span></footer>;
}
