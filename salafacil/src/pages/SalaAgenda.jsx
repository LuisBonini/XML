import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { buscarReservasDoDia, horarioParaMinutos } from '../utils/reservas'
import { Card, Badge } from '../components/ui'
import NovaReservaModal from '../components/NovaReservaModal'

const HORA_INICIO_GRADE = 8
const HORA_FIM_GRADE = 19
const INTERVALO_MIN = 30

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function gerarSlots() {
  const slots = []
  for (let m = HORA_INICIO_GRADE * 60; m < HORA_FIM_GRADE * 60; m += INTERVALO_MIN) {
    const h = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    slots.push(`${h}:${mm}`)
  }
  return slots
}

const slots = gerarSlots()

export default function SalaAgenda() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sala, setSala] = useState(null)
  const [data, setData] = useState(hojeISO())
  const [reservas, setReservas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [slotSelecionado, setSlotSelecionado] = useState(null)

  useEffect(() => {
    carregarSala()
  }, [id])

  useEffect(() => {
    carregarReservas()
  }, [id, data])

  async function carregarSala() {
    const { data: salaData, error } = await supabase.from('salas').select('*').eq('id', id).single()
    if (error) {
      navigate('/app')
      return
    }
    setSala(salaData)
  }

  async function carregarReservas() {
    setCarregando(true)
    const lista = await buscarReservasDoDia(id, data)
    setReservas(lista)
    setCarregando(false)
  }

  const ocupacaoPorSlot = useMemo(() => {
    const mapa = new Map()
    for (const slot of slots) {
      const minutoSlot = horarioParaMinutos(slot)
      const reserva = reservas.find(
        (r) => minutoSlot >= horarioParaMinutos(r.hora_inicio) && minutoSlot < horarioParaMinutos(r.hora_fim)
      )
      mapa.set(slot, reserva || null)
    }
    return mapa
  }, [reservas])

  if (!sala) return null

  return (
    <div>
      <button onClick={() => navigate('/app')} className="mb-4 text-sm text-slate-500 hover:text-slate-800">
        ← Voltar para salas
      </button>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{sala.nome}</h1>
          <p className="text-sm text-slate-500">
            {sala.andar && `${sala.andar} · `}
            {sala.capacidade && `${sala.capacidade} pessoas`}
          </p>
        </div>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <Card>
        {carregando ? (
          <p className="text-sm text-slate-500">Carregando agenda...</p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
            {slots.map((slot) => {
              const reserva = ocupacaoPorSlot.get(slot)
              const ocupado = !!reserva
              return (
                <button
                  key={slot}
                  disabled={ocupado}
                  onClick={() => setSlotSelecionado(slot)}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-sm transition ${
                    ocupado
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-slate-200 hover:border-brand-400 hover:bg-brand-50'
                  }`}
                >
                  <span className="font-medium">{slot}</span>
                  {ocupado ? (
                    <span className="truncate text-xs">{reserva.motivo}</span>
                  ) : (
                    <span className="text-xs text-green-600">Disponível</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {reservas.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-slate-700">Reservas do dia</h2>
          <div className="space-y-2">
            {reservas.map((r) => (
              <Card key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {r.hora_inicio} – {r.hora_fim} · {r.motivo}
                  </p>
                  <p className="text-xs text-slate-500">Reservado por {r.usuario_nome}</p>
                </div>
                <Badge color="blue">{r.participantes ? 'Com participantes' : 'Reunião interna'}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {slotSelecionado && (
        <NovaReservaModal
          sala={sala}
          dataKey={data}
          horaInicioSugerida={slotSelecionado}
          onClose={() => setSlotSelecionado(null)}
          onCriada={() => {
            setSlotSelecionado(null)
            carregarReservas()
          }}
        />
      )}
    </div>
  )
}
