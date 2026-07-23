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

-- Nao altere realtime.messages em projetos hospedados. As assinaturas de
-- Postgres Changes sao autorizadas pelas tabelas publicadas e suas politicas.
