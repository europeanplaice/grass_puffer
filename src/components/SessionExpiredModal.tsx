import { useState } from 'react'
import { motion } from 'motion/react'

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
    <motion.div className="session-expired-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div className="session-expired-modal"
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        <p className="session-expired-modal-msg">Your session has expired. Please log in again.</p>
        {error && <p className="session-expired-modal-error">{error}</p>}
        <button className="btn-reauth" onClick={handleClick} disabled={signing}>
          {signing ? 'Logging in...' : 'Log in again'}
        </button>
      </motion.div>
    </motion.div>
  )
}
