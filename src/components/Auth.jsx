import React, { useState } from 'react';
import { ArrowRight, BookOpen, Compass, Leaf, Music2 } from 'lucide-react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);

  // Sign Up Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');

  // Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Errors
  const [errors, setErrors] = useState({});

  const validateEmail = (email) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!fullName) newErrors.fullName = 'Full Name is required';
    if (!validateEmail(email)) newErrors.email = 'Valid email is required';
    if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!age) newErrors.age = 'Age is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Save to localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find(u => u.email === email)) {
      setErrors({ global: 'Email already exists' });
      return;
    }

    const newUser = { id: Date.now(), fullName, email, password, age };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    // Auto-login (pass object compatible with existing layout id)
    onLogin({ id: newUser.id, username: fullName, email });
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!validateEmail(email)) newErrors.email = 'Valid email is required';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      setErrors({ global: 'Invalid email or password' });
      return;
    }

    onLogin({ id: user.id, username: user.fullName, email: user.email });
  };

  const toggleMode = next => { setIsLogin(next); setErrors({}); };
  const fieldError = name => errors[name] && <p className="field-error" role="alert">{errors[name]}</p>;

  return (
    <div className="page auth-page" id="page-login">
      <section className="auth-intro" aria-labelledby="welcome-heading">
        <span className="eyebrow">A different way to discover</span>
        <h1 id="welcome-heading">Every mind has<br />its own <em>way.</em></h1>
        <p>Discover how you learn best. Explore your strengths through words, visuals and music, then make every lesson your own.</p>
        <div className="learning-art" aria-hidden="true">
          <div className="art-arch" /><div className="art-circle" />
          <div className="art-book" /><div className="art-book art-book-front"><BookOpen size={32} strokeWidth={1} /></div>
          <Leaf className="art-sprig" size={38} strokeWidth={1} /><div className="art-ground" />
        </div>
        <div className="auth-paths"><span><Compass size={14} /> Visual thinking</span><span><BookOpen size={14} /> Language</span><span><Music2 size={14} /> Music</span></div>
      </section>
      <section className="auth-form-card" aria-labelledby="auth-heading">
        <span className="eyebrow">Your learning journey</span>
        <h2 id="auth-heading">{isLogin ? 'Welcome back.' : 'Begin something good.'}</h2>
        <p>{isLogin ? 'Sign in and pick up where you left off.' : 'Create your student account to get started.'}</p>
        <div className="auth-tabs" role="group" aria-label="Account access">
          <button type="button" aria-pressed={isLogin} onClick={() => toggleMode(true)}>Sign in</button>
          <button type="button" aria-pressed={!isLogin} onClick={() => toggleMode(false)}>Create account</button>
        </div>
        {errors.global && <div className="form-error" role="alert">{errors.global}</div>}
        <form onSubmit={isLogin ? handleSignIn : handleSignUp} className="auth-form">
          {!isLogin && <>
            <div><label htmlFor="full-name">Full name</label><input id="full-name" autoComplete="name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} />{fieldError('fullName')}</div>
            <div><label htmlFor="age">Age</label><input id="age" type="number" value={age} onChange={e => setAge(e.target.value)} />{fieldError('age')}</div>
          </>}
          <div><label htmlFor="email">Email address</label><input id="email" autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />{fieldError('email')}</div>
          <div><label htmlFor="password">Password</label><div className="password-field">
            <input id="password" autoComplete={isLogin ? 'current-password' : 'new-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>{fieldError('password')}</div>
          {!isLogin && <div><label htmlFor="confirm-password">Confirm password</label><div className="password-field">
            <input id="confirm-password" autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            <button type="button" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? 'Hide' : 'Show'}</button>
          </div>{fieldError('confirmPassword')}</div>}
          <button type="submit" className="btn primary-btn">{isLogin ? 'Continue to your dashboard' : 'Create account'}<ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">{isLogin ? 'New to Multi Intelligence? ' : 'Already have an account? '}<button type="button" className="text-button" onClick={() => toggleMode(!isLogin)}>{isLogin ? 'Get started' : 'Sign in'}</button></p>
      </section>
    </div>
  );
}
