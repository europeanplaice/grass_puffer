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
      setError('再ログインに失敗しました。もう一度お試しください。')
      setSigning(false)
    }
  }

  return (
    <div className="session-expired-overlay">
      <div className="session-expired-modal">
        <p className="session-expired-modal-msg">セッションが切れました。再ログインしてください。</p>
        {error && <p className="session-expired-modal-error">{error}</p>}
        <button className="btn-reauth" onClick={handleClick} disabled={signing}>
          {signing ? 'ログイン中…' : '再ログイン'}
        </button>
      </div>
    </div>
  )
}
