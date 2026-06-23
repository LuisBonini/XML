import { useState } from 'react'
import Modal from './Modal'
import { Button, Input } from './ui'
import { criarReserva } from '../utils/reservas'
import { useAuth } from '../contexts/AuthContext'

export default function NovaReservaModal({ sala, dataKey, horaInicioSugerida, onClose, onCriada }) {
  const { usuario } = useAuth()
  const [horaInicio, setHoraInicio] = useState(horaInicioSugerida || '09:00')
  const [horaFim, setHoraFim] = useState(somarMinutos(horaInicioSugerida || '09:00', 30))
  const [motivo, setMotivo] = useState('')
  const [participantes, setParticipantes] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function aoSalvar(e) {
    e.preventDefault()
    setErro('')

    if (horaFim <= horaInicio) {
      setErro('O horário de término deve ser depois do início.')
      return
    }

    setSalvando(true)
    const { error } = await criarReserva({
      empresaId: usuario.empresa_id,
      salaId: sala.id,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      dataKey,
      horaInicio,
      horaFim,
      motivo,
      participantes,
    })
    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }
    onCriada()
  }

  return (
    <Modal titulo={`Reservar ${sala.nome}`} onClose={onClose}>
      <form className="space-y-4" onSubmit={aoSalvar}>
        <p className="text-sm text-slate-500">
          {new Date(dataKey + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>

        {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Input label="Início" type="time" required value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          <Input label="Fim" type="time" required value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
        </div>
        <Input label="Motivo da reunião" required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <Input
          label="Participantes (opcional)"
          placeholder="Ex: João, Maria, Equipe de Vendas"
          value={participantes}
          onChange={(e) => setParticipantes(e.target.value)}
        />

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Reservando...' : 'Confirmar reserva'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function somarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  const hh = Math.floor((total % 1440) / 60)
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
