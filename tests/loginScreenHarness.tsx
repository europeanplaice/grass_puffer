import { createRoot } from 'react-dom/client'
import { LoginScreen } from '../src/components/LoginScreen'
import { I18nProvider } from '../src/i18n'
import '../src/styles.css'

const root = createRoot(document.getElementById('root') as HTMLElement)

interface AppProps {
  tokenExpired?: boolean
}

window.loginScreenHarness = {
  render: ({ tokenExpired }: AppProps = {}) => {
    root.render(
      <I18nProvider>
        <LoginScreen
          onSignIn={() => { console.log('sign in clicked') }}
          tokenExpired={tokenExpired}
          key={Date.now()}
        />
      </I18nProvider>
    )
  },
}
