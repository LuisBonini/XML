import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '../lib/supabaseClient'
import {
  horarioParaMinutos,
  horariosSeSobrepoem,
  existeConflito,
  criarReserva,
  cancelarReserva,
} from './reservas'

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

// Simula a query builder encadeável do supabase-js. Cada chamada a from()
// consome a próxima resposta da fila, independente de quais métodos (select,
// eq, order, insert, single, delete) forem encadeados depois.
function mockRespostas(respostas) {
  let indice = 0
  supabase.from.mockImplementation(() => {
    const resposta = respostas[indice++] ?? { data: null, error: null }
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      insert: () => builder,
      delete: () => builder,
      single: () => builder,
      then: (resolve) => resolve(resposta),
    }
    return builder
  })
}

describe('horarioParaMinutos', () => {
  it('converte HH:MM em minutos desde a meia-noite', () => {
    expect(horarioParaMinutos('00:00')).toBe(0)
    expect(horarioParaMinutos('09:30')).toBe(570)
    expect(horarioParaMinutos('23:59')).toBe(1439)
  })
})

describe('horariosSeSobrepoem', () => {
  it('detecta sobreposição parcial', () => {
    expect(horariosSeSobrepoem('09:00', '10:00', '09:30', '10:30')).toBe(true)
  })

  it('detecta uma reserva totalmente contida na outra', () => {
    expect(horariosSeSobrepoem('09:00', '12:00', '10:00', '11:00')).toBe(true)
  })

  it('detecta reservas idênticas como conflito', () => {
    expect(horariosSeSobrepoem('09:00', '10:00', '09:00', '10:00')).toBe(true)
  })

  it('NÃO considera conflito quando uma reserva termina exatamente quando a outra começa', () => {
    expect(horariosSeSobrepoem('09:00', '10:00', '10:00', '11:00')).toBe(false)
    expect(horariosSeSobrepoem('10:00', '11:00', '09:00', '10:00')).toBe(false)
  })

  it('NÃO considera conflito quando os horários não se tocam', () => {
    expect(horariosSeSobrepoem('09:00', '10:00', '14:00', '15:00')).toBe(false)
  })
})

describe('existeConflito', () => {
  beforeEach(() => {
    supabase.from.mockReset()
  })

  it('retorna true quando há reserva sobreposta no mesmo dia/sala', async () => {
    mockRespostas([
      { data: [{ hora_inicio: '09:00', hora_fim: '10:00' }], error: null },
    ])
    const conflito = await existeConflito('sala-1', '2026-01-10', '09:30', '10:30')
    expect(conflito).toBe(true)
  })

  it('retorna false quando não há sobreposição', async () => {
    mockRespostas([
      { data: [{ hora_inicio: '09:00', hora_fim: '10:00' }], error: null },
    ])
    const conflito = await existeConflito('sala-1', '2026-01-10', '10:00', '11:00')
    expect(conflito).toBe(false)
  })
})

describe('criarReserva', () => {
  beforeEach(() => {
    supabase.from.mockReset()
  })

  const payloadBase = {
    empresaId: 'empresa-1',
    salaId: 'sala-1',
    usuarioId: 'usuario-1',
    usuarioNome: 'Maria',
    dataKey: '2026-01-10',
    horaInicio: '09:00',
    horaFim: '10:00',
    motivo: 'Reunião de vendas',
    participantes: '',
  }

  it('bloqueia a criação no client quando já existe conflito', async () => {
    mockRespostas([
      { data: [{ hora_inicio: '09:00', hora_fim: '10:00' }], error: null },
    ])
    const { data, error } = await criarReserva(payloadBase)
    expect(data).toBeUndefined()
    expect(error.message).toMatch(/já existe uma reserva/i)
    expect(supabase.from).toHaveBeenCalledTimes(1) // não deve nem tentar o insert
  })

  it('cria a reserva quando não há conflito', async () => {
    mockRespostas([
      { data: [], error: null }, // busca do dia: nenhuma reserva
      { data: { id: 'reserva-1', ...payloadBase }, error: null }, // insert
    ])
    const { data, error } = await criarReserva(payloadBase)
    expect(error).toBeUndefined()
    expect(data.id).toBe('reserva-1')
  })

  it('traduz erro de constraint de sobreposição do banco (corrida entre dois usuários)', async () => {
    mockRespostas([
      { data: [], error: null }, // client não viu conflito (corrida)
      { data: null, error: { code: '23P01', message: 'exclusion violation' } }, // banco rejeitou
    ])
    const { data, error } = await criarReserva(payloadBase)
    expect(data).toBeUndefined()
    expect(error.message).toMatch(/já existe uma reserva/i)
  })
})

describe('cancelarReserva', () => {
  beforeEach(() => {
    supabase.from.mockReset()
  })

  it('retorna sem erro quando a exclusão funciona', async () => {
    mockRespostas([{ data: null, error: null }])
    const { error } = await cancelarReserva('reserva-1')
    expect(error).toBeNull()
  })

  it('propaga erro do banco', async () => {
    mockRespostas([{ data: null, error: { message: 'falha ao cancelar' } }])
    const { error } = await cancelarReserva('reserva-1')
    expect(error.message).toBe('falha ao cancelar')
  })
})
