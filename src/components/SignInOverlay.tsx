import { supabase } from '../lib/db'
import Icon from './Icon'

function signIn() {
  supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}

function signInGoogle() {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}

function enterDemoMode() {
  localStorage.setItem('tracker-demo', '1')
  window.location.reload()
}

export default function SignInOverlay() {
  return (
    <div id="signin-overlay" className="signin-overlay" style={{ display: 'flex' }}>
      <div className="signin-card">
        <div className="signin-title">MyTracker</div>
        <div className="signin-sub">Sign in to view your data</div>
        <button className="github-signin-btn" onClick={signIn}>
          <Icon name="login" size={20} style={{ verticalAlign: -4 }} />
          Sign in with GitHub
        </button>
        <button className="github-signin-btn" style={{ background: '#4285F4', color: '#fff' }} onClick={signInGoogle}>
          <Icon name="login" size={20} style={{ verticalAlign: -4 }} />
          Sign in with Google
        </button>
        <button className="github-signin-btn" style={{ background: 'var(--warn)', color: '#fff' }} onClick={enterDemoMode}>
          <Icon name="play_circle" size={20} style={{ verticalAlign: -4 }} />
          Enter Demo Mode
        </button>
      </div>
    </div>
  )
}
