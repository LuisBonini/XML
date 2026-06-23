import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Input, Card, Badge } from '../../components/ui'
import Modal from '../../components/Modal'

const RECURSOS_DISPONIVEIS = ['TV', 'Projetor', 'Videoconferência', 'Lousa', 'Ar-condicionado']

export default function AdminSalas() {
  const { usuario } = useAuth()
  const [salas, setSalas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(null) // sala em edição ou {} para nova

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('salas').select('*').order('nome')
    setSalas(data || [])
    setCarregando(false)
  }

  async function aoDesativar(sala) {
    if (!confirm(`Desativar a sala "${sala.nome}"? Ela deixará de aparecer para os usuários.`)) return
    await supabase.from('salas').update({ ativo: !sala.ativo }).eq('id', sala.id)
    carregar()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Gerenciar salas</h1>
        <Button onClick={() => setEditando({})}>Nova sala</Button>
      </div>

      {carregando ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : (
        <div className="space-y-3">
          {salas.map((sala) => (
            <Card key={sala.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{sala.nome}</p>
                  {!sala.ativo && <Badge color="red">Inativa</Badge>}
                </div>
                <p className="text-sm text-slate-500">
                  {sala.andar && `${sala.andar} · `}
                  {sala.capacidade && `${sala.capacidade} pessoas`}
                </p>
                {sala.recursos?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {sala.recursos.map((r) => (
                      <Badge key={r} color="blue">{r}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditando(sala)}>
                  Editar
                </Button>
                <Button variant={sala.ativo ? 'danger' : 'secondary'} onClick={() => aoDesativar(sala)}>
                  {sala.ativo ? 'Desativar' : 'Reativar'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editando && (
        <FormularioSala
          sala={editando}
          empresaId={usuario.empresa_id}
          onClose={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null)
            carregar()
          }}
        />
      )}
    </div>
  )
}

function FormularioSala({ sala, empresaId, onClose, onSalvo }) {
  const ehNova = !sala.id
  const [nome, setNome] = useState(sala.nome || '')
  const [andar, setAndar] = useState(sala.andar || '')
  const [capacidade, setCapacidade] = useState(sala.capacidade || '')
  const [recursos, setRecursos] = useState(sala.recursos || [])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function alternarRecurso(recurso) {
    setRecursos((atual) =>
      atual.includes(recurso) ? atual.filter((r) => r !== recurso) : [...atual, recurso]
    )
  }

  async function aoSalvar(e) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    const payload = {
      nome,
      andar,
      capacidade: capacidade ? Number(capacidade) : null,
      recursos,
    }

    const { error } = ehNova
      ? await supabase.from('salas').insert({ ...payload, empresa_id: empresaId })
      : await supabase.from('salas').update(payload).eq('id', sala.id)

    setSalvando(false)
    if (error) return setErro(error.message)
    onSalvo()
  }

  return (
    <Modal titulo={ehNova ? 'Nova sala' : 'Editar sala'} onClose={onClose}>
      <form className="space-y-4" onSubmit={aoSalvar}>
        {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
        <Input label="Nome da sala" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input label="Andar / Localização" value={andar} onChange={(e) => setAndar(e.target.value)} />
        <Input
          label="Capacidade (pessoas)"
          type="number"
          min={1}
          value={capacidade}
          onChange={(e) => setCapacidade(e.target.value)}
        />
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Recursos</span>
          <div className="flex flex-wrap gap-2">
            {RECURSOS_DISPONIVEIS.map((recurso) => (
              <button
                key={recurso}
                type="button"
                onClick={() => alternarRecurso(recurso)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  recursos.includes(recurso)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {recurso}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
