import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Card, Badge } from '../components/ui'

export default function Dashboard() {
  const [salas, setSalas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    carregarSalas()
  }, [])

  async function carregarSalas() {
    setCarregando(true)
    const { data } = await supabase
      .from('salas')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    setSalas(data || [])
    setCarregando(false)
  }

  if (carregando) return <p className="text-sm text-slate-500">Carregando salas...</p>

  if (salas.length === 0) {
    return (
      <Card className="text-center text-slate-500">
        Nenhuma sala cadastrada ainda. Um administrador pode cadastrar salas em "Gerenciar salas".
      </Card>
    )
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Salas de reunião</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {salas.map((sala) => (
          <Card
            key={sala.id}
            className="cursor-pointer transition hover:border-brand-300 hover:shadow-md"
          >
            <button className="block w-full text-left" onClick={() => navigate(`/app/salas/${sala.id}`)}>
              <div className="flex items-start justify-between">
                <h2 className="font-medium text-slate-900">{sala.nome}</h2>
                {sala.andar && <Badge>{sala.andar}</Badge>}
              </div>
              {sala.capacidade && (
                <p className="mt-1 text-sm text-slate-500">Capacidade: {sala.capacidade} pessoas</p>
              )}
              {sala.recursos?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sala.recursos.map((r) => (
                    <Badge key={r} color="blue">{r}</Badge>
                  ))}
                </div>
              )}
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}
