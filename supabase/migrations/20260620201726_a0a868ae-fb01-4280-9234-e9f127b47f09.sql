-- ============================================
-- Tabelas operacionais compartilhadas pelo time
-- (todo usuário autenticado lê/escreve)
-- ============================================

-- DIARISTAS
CREATE TABLE public.diaristas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  bairro TEXT NOT NULL DEFAULT '',
  setor_experiencia TEXT[] NOT NULL DEFAULT '{}',
  presencas INTEGER NOT NULL DEFAULT 0,
  faltas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diaristas TO authenticated;
GRANT ALL ON public.diaristas TO service_role;

ALTER TABLE public.diaristas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can read diaristas" ON public.diaristas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert diaristas" ON public.diaristas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team can update diaristas" ON public.diaristas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can delete diaristas" ON public.diaristas
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_diaristas_updated_at
  BEFORE UPDATE ON public.diaristas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SETORES CUSTOMIZADOS
CREATE TABLE public.setores_custom (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores_custom TO authenticated;
GRANT ALL ON public.setores_custom TO service_role;

ALTER TABLE public.setores_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can read setores" ON public.setores_custom
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert setores" ON public.setores_custom
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team can update setores" ON public.setores_custom
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can delete setores" ON public.setores_custom
  FOR DELETE TO authenticated USING (true);

-- DEMANDAS
CREATE TABLE public.demandas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL DEFAULT '',
  data DATE NOT NULL,
  loja TEXT NOT NULL DEFAULT '',
  setor TEXT NOT NULL DEFAULT '',
  horario_entrada TEXT NOT NULL DEFAULT '',
  horario_saida TEXT NOT NULL DEFAULT '',
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  diarista_id UUID NULL,
  diarista_nome TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente',
  observacoes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandas TO authenticated;
GRANT ALL ON public.demandas TO service_role;

ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can read demandas" ON public.demandas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert demandas" ON public.demandas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team can update demandas" ON public.demandas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can delete demandas" ON public.demandas
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_demandas_updated_at
  BEFORE UPDATE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_demandas_data ON public.demandas(data);
CREATE INDEX idx_demandas_status ON public.demandas(status);
CREATE INDEX idx_demandas_diarista ON public.demandas(diarista_id);

-- REGISTROS FINANCEIROS (com passagem e adiantamento separados + pago)
CREATE TABLE public.registros_financeiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diarista_id UUID NULL,
  diarista_nome TEXT NOT NULL DEFAULT '',
  loja TEXT NOT NULL DEFAULT '',
  data DATE NOT NULL,
  horario_entrada TEXT NOT NULL DEFAULT '',
  horario_saida TEXT NOT NULL DEFAULT '',
  setor TEXT NOT NULL DEFAULT '',
  valor_diaria NUMERIC(10,2) NOT NULL DEFAULT 0,
  passagem NUMERIC(10,2) NOT NULL DEFAULT 0,
  adiantamento NUMERIC(10,2) NOT NULL DEFAULT 0,
  custos_adicionais NUMERIC(10,2) NOT NULL DEFAULT 0,
  pago BOOLEAN NOT NULL DEFAULT false,
  pago_em TIMESTAMPTZ NULL,
  observacoes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_financeiros TO authenticated;
GRANT ALL ON public.registros_financeiros TO service_role;

ALTER TABLE public.registros_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can read registros" ON public.registros_financeiros
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert registros" ON public.registros_financeiros
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team can update registros" ON public.registros_financeiros
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can delete registros" ON public.registros_financeiros
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_registros_updated_at
  BEFORE UPDATE ON public.registros_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_registros_data ON public.registros_financeiros(data);
CREATE INDEX idx_registros_diarista ON public.registros_financeiros(diarista_id);
CREATE INDEX idx_registros_pago ON public.registros_financeiros(pago);

-- Habilitar Realtime para todas as tabelas operacionais
ALTER TABLE public.diaristas REPLICA IDENTITY FULL;
ALTER TABLE public.setores_custom REPLICA IDENTITY FULL;
ALTER TABLE public.demandas REPLICA IDENTITY FULL;
ALTER TABLE public.registros_financeiros REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.diaristas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.setores_custom;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registros_financeiros;
