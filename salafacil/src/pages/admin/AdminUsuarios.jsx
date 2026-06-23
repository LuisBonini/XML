import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Input, Card, Badge } from '../../components/ui'

export default function AdminUsuarios() {
  const { usuario } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [convites, setConvites] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [emailConvite, setEmailConvite] = useState('')
  const [roleConvite, setRoleConvite] = useState('user')
  const [erroConvite, setErroConvite] = useState('')
  const [enviandoConvite, setEnviandoConvite] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [{ data: usuariosData }, { data: convitesData }] = await Promise.all([
      supabase.from('usuarios').select('*').order('nome'),
      supabase.from('convites').select('*').order('criado_em'),
    ])
    setUsuarios(usuariosData || [])
    setConvites(convitesData || [])
    setCarregando(false)
  }

  async function aoConvidar(e) {
    e.preventDefault()
    setErroConvite('')
    setEnviandoConvite(true)
    const { error } = await supabase.from('convites').insert({
      empresa_id: usuario.empresa_id,
      email: emailConvite.trim().toLowerCase(),
      role: roleConvite,
      convidado_por: usuario.id,
    })
    setEnviandoConvite(false)
    if (error) {
      setErroConvite(error.code === '23505' ? 'Este e-mail já tem um convite pendente.' : error.message)
      return
    }
    setEmailConvite('')
    carregar()
  }

  async function aoRemoverConvite(id) {
    await supabase.from('convites').delete().eq('id', id)
    carregar()
  }

  async function aoAlternarRole(u) {
    const novoRole = u.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`Tornar ${u.nome} ${novoRole === 'admin' ? 'administrador' : 'usuário comum'}?`)) return
    await supabase.from('usuarios').update({ role: novoRole }).eq('id', u.id)
    carregar()
  }

  async function aoAlternarAtivo(u) {
    await supabase.from('usuarios').update({ ativo: !u.ativo }).eq('id', u.id)
    carregar()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Usuários da empresa</h1>
        {carregando ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="space-y-2">
            {usuarios.map((u) => (
              <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{u.nome}</p>
                    <Badge color={u.role === 'admin' ? 'blue' : 'slate'}>{u.role}</Badge>
                    {!u.ativo && <Badge color="red">Inativo</Badge>}
                  </div>
                  <p className="text-sm text-slate-500">{u.email}</p>
                </div>
                <div className="flex gap-2">
                  {u.id !== usuario.id && (
                    <>
                      <Button variant="secondary" onClick={() => aoAlternarRole(u)}>
                        {u.role === 'admin' ? 'Tornar usuário' : 'Tornar admin'}
                      </Button>
                      <Button variant={u.ativo ? 'danger' : 'secondary'} onClick={() => aoAlternarAtivo(u)}>
                        {u.ativo ? 'Desativar' : 'Reativar'}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Convidar novo usuário</h2>
        <Card>
          <form className="flex flex-wrap items-end gap-3" onSubmit={aoConvidar}>
            <div className="min-w-[220px] flex-1">
              <Input
                label="E-mail"
                type="email"
                required
                value={emailConvite}
                onChange={(e) => setEmailConvite(e.target.value)}
              />
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Papel</span>
              <select
                value={roleConvite}
                onChange={(e) => setRoleConvite(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="user">Usuário</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <Button type="submit" disabled={enviandoConvite}>
              {enviandoConvite ? 'Enviando...' : 'Convidar'}
            </Button>
          </form>
          {erroConvite && <p className="mt-2 text-sm text-red-600">{erroConvite}</p>}
          <p className="mt-3 text-xs text-slate-500">
            Compartilhe com a pessoa convidada o link de cadastro e peça para usar a aba "Tenho convite" com
            este mesmo e-mail.
          </p>
        </Card>

        {convites.length > 0 && (
          <div className="mt-3 space-y-2">
            {convites.map((c) => (
              <Card key={c.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-slate-900">{c.email}</p>
                  <Badge>{c.role}</Badge>
                </div>
                <Button variant="ghost" onClick={() => aoRemoverConvite(c.id)}>
                  Cancelar convite
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
