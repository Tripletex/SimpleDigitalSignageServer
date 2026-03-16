import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { csrfFetch } from '../utils/csrfFetch';
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
  const [verificationSent, setVerificationSent] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [isInvitation, setIsInvitation] = useState(false);
  const [invitingTenant, setInvitingTenant] = useState<{ id: string } | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

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

    // Extract token from URL - check both query param and route param
    let token = null;

    // Check for query parameter (e.g., ?token=abc123)
    const queryParams = new URLSearchParams(location.search);
    token = queryParams.get('token');

    // If no query param, check for route parameter (e.g., /verify-email/abc123)
    if (!token && location.pathname.startsWith('/verify-email/')) {
      const pathParts = location.pathname.split('/');
      if (pathParts.length >= 3) {
        token = pathParts[2];
      }
    }

    console.log("Found token in URL:", token);

    if (token) {
      verifyEmailToken(token);
    }
  }, [navigate, setIsAuthenticated, setUser, location]);

  const verifyEmailToken = async (token: string, retryCount = 0) => {
    setLoading(true);
    setError(null);
    
    console.log("Verifying token:", token);
    
    try {
      const url = `/api/auth/verify-email/${token}`;
      console.log("Fetching URL:", url);
      
      const response = await fetch(url);
      console.log("Response status:", response.status);
      
      // Handle potential network errors with retry
      if (!response.ok && (response.status === 0 || response.status >= 500) && retryCount < 3) {
        console.log(`Retrying verification (attempt ${retryCount + 1})...`);
        setLoading(false);
        setTimeout(() => {
          verifyEmailToken(token, retryCount + 1);
        }, 1000); // Wait 1 second before retry
        return;
      }
      
      const responseText = await response.text();
      console.log("Response text:", responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        throw new Error(`Invalid server response: ${responseText.substring(0, 100)}...`);
      }
      
      if (!response.ok) {
        throw new Error(data.message || `Failed to verify email: ${response.status}`);
      }
      
      console.log("Verification successful, data:", data);
      
      if (data.success) {
        setVerifiedEmail(data.email);
        setIsRegistering(true);
        
        // Handle invitation data if present
        if (data.isInvitation) {
          console.log("Processing invitation data:", data.isInvitation, data.invitingTenant);
          setIsInvitation(true);
          if (data.invitingTenant) {
            setInvitingTenant(data.invitingTenant);
          }
          setMessage(`You've been invited to join an organization. Please complete your registration.`);
        } else {
          setMessage('Email verified! Please complete your registration.');
        }
        
        // Clear the token from the URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        throw new Error(data.message || 'Email verification failed');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Email verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      console.log('Starting authentication for:', email);
      
      // 1. Get authentication options
      console.log('Requesting authentication options...');
      const optionsResponse = await fetch('/api/auth/webauthn/authentication-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        credentials: 'include' // Important for session cookies
      });
      
      // Handle non-JSON responses
      const optionsResponseText = await optionsResponse.text();
      let options;
      
      try {
        options = JSON.parse(optionsResponseText);
      } catch (parseError) {
        console.error('Failed to parse authentication options response:', optionsResponseText);
        throw new Error(`Server returned invalid response: ${optionsResponseText.substring(0, 100)}...`);
      }
      
      if (!optionsResponse.ok) {
        throw new Error(options.message || `Failed to get authentication options: ${optionsResponse.status}`);
      }
      
      console.log('Authentication options received:', options);
      
      // Prepare and log the options for debugging
      const publicKeyOptions = prepareAuthenticationOptions(options);
      console.log('Prepared publicKey options:', publicKeyOptions);
      
      // 2. Use WebAuthn API to get credentials
      console.log('Requesting credentials from browser...');
      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions
      }) as PublicKeyCredential;
      
      console.log('Credential received from browser');
      
      // 3. Verify the authentication
      console.log('Sending credential to server for verification...');
      const preparedResponse = prepareAuthenticationResponse(credential);
      console.log('Prepared response:', preparedResponse);
      
      const authResponse = await fetch('/api/auth/webauthn/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preparedResponse),
        credentials: 'include', // Important for session cookies
      });
      
      // Handle non-JSON responses
      const authResponseText = await authResponse.text();
      let authResult;
      
      try {
        authResult = JSON.parse(authResponseText);
      } catch (parseError) {
        console.error('Failed to parse authentication result:', authResponseText);
        throw new Error(`Server returned invalid response: ${authResponseText.substring(0, 100)}...`);
      }
      
      if (!authResponse.ok) {
        throw new Error(authResult.message || `Authentication failed: ${authResponse.status}`);
      }
      
      console.log('Authentication result:', authResult);
      
      if (authResult.success) {
        console.log('Authentication successful, setting user state');
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

  const sendVerificationEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/auth/self-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setVerificationSent(true);
        setMessage('Verification email sent! Please check your inbox for a link to complete registration.');
      } else {
        throw new Error(data.message || 'Failed to send verification email');
      }
    } catch (err) {
      console.error('Error sending verification email:', err);
      setError(err instanceof Error ? err.message : 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async (e: React.FormEvent, retryCount = 0) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    if (!verifiedEmail) {
      setError('Email verification required');
      setLoading(false);
      return;
    }
    
    console.log("Completing registration for verified email:", verifiedEmail);
    console.log("Using display name:", displayName || verifiedEmail.split('@')[0]);
    
    try {
      // 1. Complete registration — returns WebAuthn options directly (no user created yet)
      const completeResponse = await csrfFetch('/api/auth/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: displayName || verifiedEmail.split('@')[0],
        }),
        credentials: 'include',
      });

      // Handle potential network errors with retry
      if (!completeResponse.ok && (completeResponse.status === 0 || completeResponse.status >= 500) && retryCount < 3) {
        console.log(`Retrying registration completion (attempt ${retryCount + 1})...`);
        setLoading(false);
        setTimeout(() => {
          completeRegistration(e, retryCount + 1);
        }, 1000);
        return;
      }

      const completeText = await completeResponse.text();
      console.log("Complete registration response:", completeText);

      let responseData;
      try {
        responseData = JSON.parse(completeText);
      } catch (e) {
        console.error("Failed to parse complete registration response:", e);
        throw new Error(`Invalid server response: ${completeText.substring(0, 100)}...`);
      }

      if (!completeResponse.ok || !responseData.success) {
        throw new Error(responseData.message || 'Failed to complete registration');
      }

      // 2. Use WebAuthn API to create passkey (options came back from complete-registration)
      const options = responseData.registrationOptions;
      console.log('Registration options received:', options);

      const publicKeyOptions = prepareRegistrationOptions(options);
      console.log('Prepared publicKey options:', publicKeyOptions);

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions
      }) as PublicKeyCredential;

      console.log('Credential created:', credential);

      // 3. Verify passkey and create account in one step
      const verifyResponse = await csrfFetch('/api/auth/webauthn/register-new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prepareRegistrationResponse(credential)),
        credentials: 'include',
      });

      const verifyText = await verifyResponse.text();
      console.log("Verify registration response:", verifyText);

      let verifyResult;
      try {
        verifyResult = JSON.parse(verifyText);
      } catch (e) {
        console.error("Failed to parse verify response:", e);
        throw new Error(`Invalid server response: ${verifyText.substring(0, 100)}...`);
      }

      if (!verifyResponse.ok || !verifyResult.success) {
        throw new Error(verifyResult.message || 'Registration failed');
      }

      // User account created and logged in
      setIsAuthenticated(true);
      setUser(verifyResult.user);
      navigate('/dashboard');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Render initial registration form (email only)
  const renderRegistrationStep1 = () => (
    <form onSubmit={sendVerificationEmail}>
      <div className="form-group">
        <label htmlFor="email">Email Address</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      
      <div className="form-actions">
        <button 
          type="submit" 
          className="primary-button"
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Start Registration'}
        </button>
      </div>
    </form>
  );

  // Render complete registration form (after email verification)
  const renderRegistrationStep2 = () => (
    <form onSubmit={completeRegistration}>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          value={verifiedEmail || ''}
          disabled={true}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="displayName">Display Name</label>
        <input
          type="text"
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={loading}
        />
        <small>Leave blank to use your email name</small>
      </div>
      
      <div className="form-actions">
        <button 
          type="submit" 
          className="primary-button"
          disabled={loading}
        >
          {loading ? 'Processing...' : isInvitation ? 'Accept Invitation' : 'Complete Registration'}
        </button>
      </div>
    </form>
  );

  // Render waiting for verification view
  const renderWaitingForVerification = () => (
    <div className="verification-waiting">
      <h2>Check Your Email</h2>
      <p>We've sent a verification link to <strong>{email}</strong>.</p>
      <p>Click the link in the email to complete your registration.</p>
      <p>Don't see the email? Check your spam folder.</p>
      
      {/* Option to resend email */}
      <button 
        onClick={sendVerificationEmail} 
        className="secondary-button"
        disabled={loading}
      >
        {loading ? 'Sending...' : 'Resend Verification Email'}
      </button>
      
      {/* Option to change email */}
      <button 
        onClick={() => setVerificationSent(false)} 
        className="text-button"
        disabled={loading}
      >
        Use a different email address
      </button>
    </div>
  );

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>
          {verifiedEmail ? (isInvitation ? 'Accept Invitation' : 'Complete Registration') : 
            (isRegistering ? (verificationSent ? 'Check Your Email' : 'Create Account') : 'Sign In')}
        </h1>
        
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}
        
        {isRegistering ? (
          verifiedEmail ? (
            // Step 2: Complete registration with display name and passkey
            renderRegistrationStep2()
          ) : verificationSent ? (
            // Waiting for email verification
            renderWaitingForVerification()
          ) : (
            // Step 1: Enter email for verification
            renderRegistrationStep1()
          )
        ) : (
          // Login form
          <form onSubmit={handleLogin}>
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
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="primary-button"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Sign in with Passkey'}
              </button>
            </div>
          </form>
        )}
        
        {/* Only show toggle option if not in the middle of a flow */}
        {!verifiedEmail && !verificationSent && (
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
        )}
      </div>
    </div>
  );
};

export default Login;