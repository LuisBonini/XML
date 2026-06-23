import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { cancelarReserva } from '../utils/reservas'
import { useAuth } from '../contexts/AuthContext'
import { Card, Button, Badge } from '../components/ui'

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function MeusAgendamentos() {
  const { usuario } = useAuth()
  const [reservas, setReservas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [cancelandoId, setCancelandoId] = useState(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('reservas')
      .select('*, salas(nome)')
      .eq('usuario_id', usuario.id)
      .gte('data_key', hojeISO())
      .order('data_key')
      .order('hora_inicio')
    setReservas(data || [])
    setCarregando(false)
  }

  async function aoCancelar(id) {
    setCancelandoId(id)
    await cancelarReserva(id)
    setReservas((atual) => atual.filter((r) => r.id !== id))
    setCancelandoId(null)
  }

  if (carregando) return <p className="text-sm text-slate-500">Carregando...</p>

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Meus agendamentos</h1>

      {reservas.length === 0 ? (
        <Card className="text-center text-slate-500">Você não tem reservas futuras.</Card>
      ) : (
        <div className="space-y-3">
          {reservas.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{r.salas?.nome}</p>
                <p className="text-sm text-slate-500">
                  {new Date(r.data_key + 'T00:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })}{' '}
                  · {r.hora_inicio} – {r.hora_fim}
                </p>
                <p className="mt-1 text-sm text-slate-700">{r.motivo}</p>
                {r.participantes && <Badge>{r.participantes}</Badge>}
              </div>
              <Button
                variant="danger"
                onClick={() => aoCancelar(r.id)}
                disabled={cancelandoId === r.id}
              >
                {cancelandoId === r.id ? 'Cancelando...' : 'Cancelar'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
