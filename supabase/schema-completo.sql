-- ============================================================
-- Migration: 20260620143335_35477a88-080c-409a-ab14-206d23d763ee.sql
-- ============================================================


-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  tool_call_id TEXT,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own messages" ON public.messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at ASC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New user profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- Migration: 20260620143347_bc12b523-873f-4c6b-8cce-b2af4ca4ec41.sql
-- ============================================================


REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ============================================================
-- Migration: 20260620201726_a0a868ae-fb01-4280-9234-e9f127b47f09.sql
-- ============================================================

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
  estado TEXT NOT NULL DEFAULT '',
  cidade TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  cep TEXT NOT NULL DEFAULT '',
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


-- ============================================================
-- Migration: 20260620201757_263f6e8b-4922-4417-a3a3-8bb01fcb63c2.sql
-- ============================================================

ALTER TABLE public.demandas
  ADD COLUMN rede TEXT NOT NULL DEFAULT '',
  ADD COLUMN horario TEXT NOT NULL DEFAULT '',
  ADD COLUMN tarefas_total INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN tarefas_concluidas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN check_in_at TIMESTAMPTZ NULL,
  ADD COLUMN check_in_by TEXT NOT NULL DEFAULT '';


-- ============================================================
-- Migration: 20260621204548_42ab03d9-c9a7-4f5c-a4c3-024239e0dd8c.sql
-- ============================================================

-- Enable RLS on realtime.messages (Supabase requires policies for channel access)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow only authenticated users to subscribe to the team-shared channel topics
DROP POLICY IF EXISTS "authenticated can read team realtime topics" ON realtime.messages;
CREATE POLICY "authenticated can read team realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('diaristas','demandas','setores_custom','registros_financeiros')
  OR realtime.topic() LIKE 'realtime:public:%'
);

-- Allow authenticated users to broadcast/presence on the same topics (needed for postgres_changes)
DROP POLICY IF EXISTS "authenticated can write team realtime topics" ON realtime.messages;
CREATE POLICY "authenticated can write team realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() IN ('diaristas','demandas','setores_custom','registros_financeiros')
  OR realtime.topic() LIKE 'realtime:public:%'
);


-- ============================================================
-- Migration: 20260621205108_5fee07a1-1c08-4d65-902f-97f71e5c291c.sql
-- ============================================================

-- =============== LOJAS ===============
CREATE TABLE public.lojas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  rede text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  bairro text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT 'Fortaleza',
  uf text NOT NULL DEFAULT 'CE',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lojas TO authenticated;
GRANT ALL ON public.lojas TO service_role;
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team can read lojas" ON public.lojas FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert lojas" ON public.lojas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team can update lojas" ON public.lojas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can delete lojas" ON public.lojas FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_lojas_updated_at BEFORE UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lojas (nome, rede, endereco, bairro) VALUES
('Frangolândia - Varjota', 'Frangolândia', 'Rua Frei Mansueto, 909', 'Varjota'),
('Hipermarket - Vila União', 'Hipermarket', 'Rua Livreiro Gualter, 123', 'Vila União'),
('Hipermarket - Jardim Cearense', 'Hipermarket', 'Rua Rubens Monte, 380', 'Jardim Cearense'),
('Hipermarket - Serrinha', 'Hipermarket', 'Rua Freire Alemão, 356', 'Serrinha'),
('Hipermarket - Mondubim', 'Hipermarket', 'Av. Benjamim Brasil, 1099', 'Mondubim'),
('Hipermarket - Eusébio', 'Hipermarket', 'Rua Embaúba, 5', 'Eusébio');
-- Eusébio é cidade própria; ajusta:
UPDATE public.lojas SET cidade = 'Eusébio' WHERE nome = 'Hipermarket - Eusébio';

-- =============== SETOR_VALORES ===============
CREATE TABLE public.setor_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor text NOT NULL UNIQUE,
  valor_min numeric NOT NULL DEFAULT 0,
  valor_max numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setor_valores TO authenticated;
GRANT ALL ON public.setor_valores TO service_role;
ALTER TABLE public.setor_valores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team can read setor_valores" ON public.setor_valores FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert setor_valores" ON public.setor_valores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team can update setor_valores" ON public.setor_valores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can delete setor_valores" ON public.setor_valores FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_setor_valores_updated_at BEFORE UPDATE ON public.setor_valores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============== REDE_VALORES ===============
CREATE TABLE public.rede_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rede text NOT NULL UNIQUE,
  valor_recebido numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rede_valores TO authenticated;
GRANT ALL ON public.rede_valores TO service_role;
ALTER TABLE public.rede_valores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team can read rede_valores" ON public.rede_valores FOR SELECT TO authenticated USING (true);
CREATE POLICY "team can insert rede_valores" ON public.rede_valores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team can update rede_valores" ON public.rede_valores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can delete rede_valores" ON public.rede_valores FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_rede_valores_updated_at BEFORE UPDATE ON public.rede_valores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.rede_valores (rede, valor_recebido) VALUES
('Frangolândia', 109.25),
('Hipermarket', 124.50);

-- =============== REALTIME ===============
ALTER PUBLICATION supabase_realtime ADD TABLE public.lojas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.setor_valores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rede_valores;

-- Permite que os novos canais Realtime sejam consumidos pelos membros da equipe
DROP POLICY IF EXISTS "authenticated can read team realtime topics" ON realtime.messages;
CREATE POLICY "authenticated can read team realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN ('diaristas','demandas','setores_custom','registros_financeiros','lojas','setor_valores','rede_valores')
  OR realtime.topic() LIKE 'realtime:public:%'
);

DROP POLICY IF EXISTS "authenticated can write team realtime topics" ON realtime.messages;
CREATE POLICY "authenticated can write team realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() IN ('diaristas','demandas','setores_custom','registros_financeiros','lojas','setor_valores','rede_valores')
  OR realtime.topic() LIKE 'realtime:public:%'
);
