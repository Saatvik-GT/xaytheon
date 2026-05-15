import React, { useState } from 'react';
import bcrypt from 'bcryptjs';
import './index.css';


const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', username: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (isLogin) {
      const storedUser = JSON.parse(localStorage.getItem(formData.email));
      if (!storedUser) {
        setMessage({ type: 'error', text: 'User not found!' });
        return;
      }

      const isMatch = await bcrypt.compare(formData.password, storedUser.password);
      if (isMatch) {
        setMessage({ type: 'success', text: `Welcome back, ${storedUser.username}!` });
      } else {
        setMessage({ type: 'error', text: 'Invalid password!' });
      }
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(formData.password, salt);

      const newUser = {
        username: formData.username,
        email: formData.email,
        password: hashedPassword,
      };

      localStorage.setItem(formData.email, JSON.stringify(newUser));
      setMessage({ type: 'success', text: 'Account created! Switching to login...' });
      setTimeout(() => setIsLogin(true), 1500);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">{isLogin ? 'Sign In' : 'Join Us'}</h2>
        <p className="auth-subtitle">
          {isLogin ? 'Enter your details to access your account' : 'Create a new account to get started'}
        </p>

        {message.text && (
          <div className={`auth-message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleAuth} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label>Username</label>
              <input type="text" name="username" required onChange={handleChange} />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" required onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" required onChange={handleChange} />
          </div>

          <button type="submit" className="submit-btn">
            {isLogin ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle">
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;