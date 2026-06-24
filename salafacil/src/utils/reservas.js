import { supabase } from '../lib/supabaseClient'

export function horarioParaMinutos(hora) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function horariosSeSobrepoem(inicioA, fimA, inicioB, fimB) {
  return horarioParaMinutos(inicioA) < horarioParaMinutos(fimB) &&
    horarioParaMinutos(inicioB) < horarioParaMinutos(fimA)
}

export async function buscarReservasDoDia(salaId, dataKey) {
  const { data, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('sala_id', salaId)
    .eq('data_key', dataKey)
    .order('hora_inicio')
  if (error) throw error
  return data
}

// Verificação otimista no client antes do insert. A garantia real
// contra concorrência é a exclusion constraint "sem_overlap" no banco.
export async function existeConflito(salaId, dataKey, horaInicio, horaFim) {
  const reservas = await buscarReservasDoDia(salaId, dataKey)
  return reservas.some((r) => horariosSeSobrepoem(horaInicio, horaFim, r.hora_inicio, r.hora_fim))
}

export async function criarReserva({ empresaId, salaId, usuarioId, usuarioNome, dataKey, horaInicio, horaFim, motivo, participantes }) {
  const conflito = await existeConflito(salaId, dataKey, horaInicio, horaFim)
  if (conflito) {
    return { error: { message: 'Já existe uma reserva nesse horário para esta sala.' } }
  }

  const { data, error } = await supabase
    .from('reservas')
    .insert({
      empresa_id: empresaId,
      sala_id: salaId,
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      data_key: dataKey,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      motivo,
      participantes,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23P01' || error.code === '23505') {
      return { error: { message: 'Já existe uma reserva nesse horário para esta sala.' } }
    }
    return { error }
  }

  return { data }
}

export async function cancelarReserva(reservaId) {
  const { error } = await supabase.from('reservas').delete().eq('id', reservaId)
  return { error }
}
