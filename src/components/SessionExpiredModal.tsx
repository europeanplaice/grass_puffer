import { motion } from 'motion/react'
import { useI18n } from '../i18n'

interface Props {
  onReauth: () => void
}

export function SessionExpiredModal({ onReauth }: Props) {
  const { t } = useI18n()

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
        <p className="session-expired-modal-msg">{t.session.expired}</p>
        <button className="btn-reauth" onClick={onReauth}>
          {t.session.logInAgain}
        </button>
      </motion.div>
    </motion.div>
  )
}
