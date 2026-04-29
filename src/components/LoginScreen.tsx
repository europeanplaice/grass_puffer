interface Props {
  onSignIn: () => void
}

export function LoginScreen({ onSignIn }: Props) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">📔</div>
        <h1>Grass Puffer Diary</h1>
        <p>Your private diary, stored in your Google Drive.</p>
        <button className="btn-signin" onClick={onSignIn}>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
