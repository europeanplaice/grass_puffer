import { useState } from 'react'

interface Props {
  onReauth: () => Promise<void>
}

export function SessionExpiredModal({ onReauth }: Props) {
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setSigning(true)
    setError(null)
    try {
      await onReauth()
    } catch {
      setError('Re-login failed. Please try again.')
      setSigning(false)
    }
  }

  return (
    <div className="session-expired-overlay">
      <div className="session-expired-modal">
        <p className="session-expired-modal-msg">Your session has expired. Please log in again.</p>
        {error && <p className="session-expired-modal-error">{error}</p>}
        <button className="btn-reauth" onClick={handleClick} disabled={signing}>
          {signing ? 'Logging in...' : 'Log in again'}
        </button>
      </div>
    </div>
  )
}
