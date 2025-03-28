import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import { 
  prepareRegistrationOptions, 
  prepareAuthenticationOptions,
  prepareRegistrationResponse,
  prepareAuthenticationResponse
} from '../utils/webauthn';

interface LoginProps {
  setIsAuthenticated: (isAuth: boolean) => void;
  setUser: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ setIsAuthenticated, setUser }) => {
  const [email, setEmail] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setIsAuthenticated(true);
            setUser(data.user);
            navigate('/dashboard');
          }
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
      }
    };

    checkAuth();
  }, [navigate, setIsAuthenticated, setUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // 1. Get authentication options
      const optionsResponse = await fetch('/api/auth/webauthn/authentication-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.message || 'Failed to get authentication options');
      }
      
      const options = await optionsResponse.json();
      console.log('Authentication options received:', options);
      
      // Prepare and log the options for debugging
      const publicKeyOptions = prepareAuthenticationOptions(options);
      console.log('Prepared publicKey options:', publicKeyOptions);
      
      // 2. Use WebAuthn API to get credentials
      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions
      }) as PublicKeyCredential;
      
      console.log('Credential received:', credential);
      
      // 3. Verify the authentication
      const authResponse = await fetch('/api/auth/webauthn/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prepareAuthenticationResponse(credential)),
        credentials: 'include',
      });
      
      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        throw new Error(errorData.message || 'Authentication failed');
      }
      
      const authResult = await authResponse.json();
      
      if (authResult.success) {
        setIsAuthenticated(true);
        setUser(authResult.user);
        navigate('/dashboard');
      } else {
        setError(authResult.message || 'Authentication failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // 1. Create user
      const registerResponse = await fetch('/api/auth/self-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          displayName: displayName || email.split('@')[0],
        }),
      });
      
      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        throw new Error(errorData.message || 'Failed to create user');
      }
      
      const userData = await registerResponse.json();
      
      // 2. Get WebAuthn registration options
      const optionsResponse = await fetch('/api/auth/webauthn/registration-options', {
        credentials: 'include',
      });
      
      if (!optionsResponse.ok) {
        throw new Error('Failed to get registration options');
      }
      
      const options = await optionsResponse.json();
      console.log('Registration options received:', options);
      
      // Prepare and log the options for debugging
      const publicKeyOptions = prepareRegistrationOptions(options);
      console.log('Prepared publicKey options:', publicKeyOptions);
      
      // 3. Use WebAuthn API to create credentials
      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions
      }) as PublicKeyCredential;
      
      console.log('Credential created:', credential);
      
      // 4. Verify the registration
      const verifyResponse = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prepareRegistrationResponse(credential)),
        credentials: 'include',
      });
      
      if (!verifyResponse.ok) {
        throw new Error('Failed to verify registration');
      }
      
      const verifyResult = await verifyResponse.json();
      
      if (verifyResult.success) {
        setMessage('Registration successful! You can now log in.');
        setIsRegistering(false);
      } else {
        setError(verifyResult.message || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>{isRegistering ? 'Create Account' : 'Sign In'}</h1>
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          {isRegistering && (
            <div className="form-group">
              <label htmlFor="displayName">Display Name (optional)</label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
              />
            </div>
          )}
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="primary-button"
              disabled={loading}
            >
              {loading ? 'Processing...' : isRegistering ? 'Register with Passkey' : 'Sign in with Passkey'}
            </button>
          </div>
        </form>
        
        <div className="toggle-form">
          {isRegistering ? (
            <p>
              Already have an account?{' '}
              <button 
                className="text-button"
                onClick={() => setIsRegistering(false)}
                disabled={loading}
              >
                Sign in
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button 
                className="text-button"
                onClick={() => setIsRegistering(true)}
                disabled={loading}
              >
                Create one
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;