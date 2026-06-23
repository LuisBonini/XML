import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { Button, Input, Card, Badge } from '../../components/ui'

const CORES_SUGERIDAS = ['#2563eb', '#7c3aed', '#0d9488', '#dc2626', '#ea580c', '#0f172a']

export default function AdminConfiguracoes() {
  const { empresa, recarregarPerfil } = useAuth()
  const [nome, setNome] = useState(empresa?.nome || '')
  const [corPrimaria, setCorPrimaria] = useState(empresa?.cor_primaria || '#2563eb')
  const [logoUrl, setLogoUrl] = useState(empresa?.logo_url || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvo, setSalvo] = useState(false)

  const ehPro = empresa?.plano === 'pro'

  async function aoSalvar(e) {
    e.preventDefault()
    setErro('')
    setSalvo(false)
    setSalvando(true)

    const { error } = await supabase
      .from('empresas')
      .update({ nome, cor_primaria: corPrimaria, logo_url: logoUrl || null })
      .eq('id', empresa.id)

    setSalvando(false)
    if (error) return setErro(error.message)
    await recarregarPerfil()
    setSalvo(true)
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Configurações da empresa</h1>
        <p className="mt-1 text-sm text-slate-500">Personalize o nome e a identidade visual do seu painel.</p>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Plano atual</span>
          <Badge color={ehPro ? 'green' : 'slate'}>{ehPro ? 'Pro' : 'Free'}</Badge>
        </div>
        {!ehPro && (
          <p className="text-xs text-slate-500">
            Cor e logo personalizados ficam visíveis para sua equipe em qualquer plano — a assinatura do Pro
            (cobrança via Stripe) estará disponível em breve direto aqui.
          </p>
        )}
      </Card>

      <Card>
        <form className="space-y-4" onSubmit={aoSalvar}>
          {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
          {salvo && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Configurações salvas.</div>}

          <Input label="Nome da empresa" required value={nome} onChange={(e) => setNome(e.target.value)} />

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Cor primária</span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300"
              />
              <div className="flex gap-1.5">
                {CORES_SUGERIDAS.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setCorPrimaria(cor)}
                    className="h-7 w-7 rounded-full border border-slate-200"
                    style={{ backgroundColor: cor }}
                    aria-label={`Usar cor ${cor}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <Input
            label="URL do logo (opcional)"
            placeholder="https://..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
