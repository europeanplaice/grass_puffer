import { useRef, useEffect } from 'react'
import { AppIcon } from './AppIcon'

interface Props {
  onSignIn: () => void
  onRetry?: () => void
  onForgetSession?: () => void
  authReady?: boolean
  wasPreviouslySignedIn?: boolean
  sessionExpired?: boolean
  loadFailed?: boolean
  tokenExpired?: boolean
}

export function LoginScreen({
  onSignIn,
  onRetry,
  onForgetSession,
  authReady = true,
  wasPreviouslySignedIn,
  sessionExpired,
  loadFailed,
  tokenExpired,
}: Props) {
  const disabled = !authReady || Boolean(loadFailed)
  const buttonLabel = wasPreviouslySignedIn ? 'Continue with Google' : 'Sign in with Google'
  const googleBtnRef = useRef<HTMLDivElement>(null)

  // Render official Google Sign-In button once GIS is ready
  useEffect(() => {
    if (authReady && !loadFailed && googleBtnRef.current && window.google?.accounts?.id) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: wasPreviouslySignedIn ? 'continue_with' : 'signin_with',
      })
    }
  }, [authReady, loadFailed, wasPreviouslySignedIn])

  return (
    <div className="login-screen">
      <div className="login-card">
        <AppIcon className="login-logo" />
        <h1>Grass Puffer Diary</h1>
        <p>
          {wasPreviouslySignedIn
            ? 'Continue with your previous Google session.'
            : 'Your private diary, stored in your Google Drive.'}
        </p>
        {sessionExpired && (
          <p className="session-expired-msg">Session expired. Please sign in again.</p>
        )}
        {tokenExpired && (
          <p className="session-expired-msg">
            Your session has expired.
            <button className="btn-retry" onClick={onRetry} type="button">
              Re-authenticate
            </button>
          </p>
        )}
        {loadFailed && (
          <p className="session-expired-msg">Google Sign-In could not be loaded. Check your network or browser extensions.</p>
        )}
        {!loadFailed && !authReady && (
          <p className="session-expired-msg neutral">Loading Google Sign-In…</p>
        )}
        <div ref={googleBtnRef} className="google-btn-container" />
        <button className="btn-signin-google" onClick={onSignIn} disabled={disabled} style={{ display: 'none' }}>
          <svg
            className="google-logo"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {buttonLabel}
        </button>
        {wasPreviouslySignedIn && onForgetSession && (
          <button className="btn-use-another-account" type="button" onClick={onForgetSession}>
            Use another account
          </button>
        )}
        <details className="privacy-details">
          <summary>How your data is stored</summary>
          <div className="privacy-body">
            <ul>
              <li>Stored only in your own Google Drive — this app has no backend server</li>
              <li>Browser's Content Security Policy only allows connections to Google services (<code>googleapis.com</code>, <code>accounts.google.com</code>, <code>oauth2.googleapis.com</code>) and this website.</li>
              <li>Verify: open DevTools → Network tab — every request goes to Google only</li>
            </ul>
          </div>
        </details>
        <p className="login-footer">
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          {' · '}
          <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  )
}
