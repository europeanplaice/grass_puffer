import { useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { LoginScreen } from '../src/components/LoginScreen'
import { I18nProvider } from '../src/i18n'
import '../src/styles.css'

const root = createRoot(document.getElementById('root') as HTMLElement)

interface AppProps {
  authReady?: boolean
  wasPreviouslySignedIn?: boolean
  sessionExpired?: boolean
  loadFailed?: boolean
}

function App({ authReady, wasPreviouslySignedIn, sessionExpired, loadFailed }: AppProps) {
  const [forgot, setForgot] = useState(false)

  const handleSignIn = useCallback(() => {
    console.log('sign in clicked')
  }, [])

  const handleForgetSession = useCallback(() => {
    setForgot(true)
  }, [])

  return (
    <LoginScreen
      onSignIn={handleSignIn}
      onForgetSession={forgot ? undefined : handleForgetSession}
      authReady={authReady ?? true}
      wasPreviouslySignedIn={wasPreviouslySignedIn}
      sessionExpired={sessionExpired}
      loadFailed={loadFailed}
    />
  )
}

window.loginScreenHarness = {
  render: ({ authReady, wasPreviouslySignedIn, sessionExpired, loadFailed }: AppProps = {}) => {
    root.render(
      <I18nProvider>
        <App
          authReady={authReady}
          wasPreviouslySignedIn={wasPreviouslySignedIn}
          sessionExpired={sessionExpired}
          loadFailed={loadFailed}
          key={Date.now()}
        />
      </I18nProvider>
    )
  },
}
