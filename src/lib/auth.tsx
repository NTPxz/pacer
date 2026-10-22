import { createContext, Fragment, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { connect, disconnect, flush, getStatus, onStatus, type SyncStatus } from './sync'

export type Provider = 'google' | 'facebook'

interface AuthState {
  /** false when the build has no Supabase keys — the app is guest-only */
  enabled: boolean
  user: User | null
  status: SyncStatus
  signIn: (p: Provider) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const Ctx = createContext<AuthState>({
  enabled: false,
  user: null,
  status: 'guest',
  signIn: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
})

export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SyncStatus>(getStatus())
  // bumping this remounts the app so every component re-reads local storage after a cloud pull
  const [version, setVersion] = useState(0)
  const linked = useRef<string | null>(null)

  useEffect(() => onStatus(setStatus), [])

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u && linked.current !== u.id && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        linked.current = u.id
        // run outside the auth callback — supabase-js deadlocks if we await its client in here
        setTimeout(() => {
          connect(u.id).then((changed) => changed && setVersion((v) => v + 1))
        }, 0)
      }
      if (event === 'SIGNED_OUT' && linked.current) {
        linked.current = null
        setTimeout(() => disconnect().then(() => setVersion((v) => v + 1)), 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = async (provider: Provider) => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
  }

  const signOut = async () => {
    if (!supabase) return
    await flush().catch(() => {})
    await supabase.auth.signOut()
  }

  const deleteAccount = async () => {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const res = await fetch('/api/delete-account', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
    await supabase.auth.signOut()
  }

  return (
    <Ctx.Provider value={{ enabled: !!supabase, user, status, signIn, signOut, deleteAccount }}>
      <Fragment key={version}>{children}</Fragment>
    </Ctx.Provider>
  )
}
