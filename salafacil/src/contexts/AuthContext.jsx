import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [empresa, setEmpresa] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const carregarPerfil = useCallback(async (userId) => {
    if (!userId) {
      setUsuario(null)
      setEmpresa(null)
      return
    }
    const { data: perfil } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    setUsuario(perfil ?? null)

    if (perfil?.empresa_id) {
      const { data: emp } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', perfil.empresa_id)
        .maybeSingle()
      setEmpresa(emp ?? null)
    } else {
      setEmpresa(null)
    }
  }, [])

  useEffect(() => {
    let ativo = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return
      setSession(data.session)
      await carregarPerfil(data.session?.user?.id)
      setCarregando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, novaSessao) => {
      setSession(novaSessao)
      await carregarPerfil(novaSessao?.user?.id)
    })

    return () => {
      ativo = false
      listener.subscription.unsubscribe()
    }
  }, [carregarPerfil])

  async function entrar(email, senha) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    return { error }
  }

  async function cadastrarComEmpresa({ email, senha, nomeUsuario, nomeEmpresa, slugEmpresa }) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: senha,
    })
    if (signUpError) return { error: signUpError }

    if (!signUpData.session) {
      return {
        error: null,
        confirmacaoPendente: true,
      }
    }

    const { error: rpcError } = await supabase.rpc('criar_empresa_e_admin', {
      p_nome_empresa: nomeEmpresa,
      p_slug: slugEmpresa,
      p_nome_usuario: nomeUsuario,
    })
    if (rpcError) return { error: rpcError }

    await carregarPerfil(signUpData.session.user.id)
    return { error: null }
  }

  async function cadastrarComConvite({ email, senha, nomeUsuario }) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: senha,
    })
    if (signUpError) return { error: signUpError }

    if (!signUpData.session) {
      return { error: null, confirmacaoPendente: true }
    }

    const { error: rpcError } = await supabase.rpc('aceitar_convite')
    if (rpcError) return { error: rpcError }

    if (nomeUsuario) {
      await supabase.from('usuarios').update({ nome: nomeUsuario }).eq('id', signUpData.session.user.id)
    }

    await carregarPerfil(signUpData.session.user.id)
    return { error: null }
  }

  async function sair() {
    await supabase.auth.signOut()
    setUsuario(null)
    setEmpresa(null)
  }

  const value = {
    session,
    usuario,
    empresa,
    carregando,
    autenticado: !!session,
    perfilCompleto: !!usuario,
    entrar,
    cadastrarComEmpresa,
    cadastrarComConvite,
    sair,
    recarregarPerfil: () => carregarPerfil(session?.user?.id),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
