# Direct Promocoes

Sistema de controle de diaristas, demandas, lojas, redes e financeiro.

## Rodar localmente

```bash
npm install
npm run dev
```

## Variaveis de ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```bash
VITE_SUPABASE_PROJECT_ID="seu-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-publica-anon"
VITE_SUPABASE_URL="https://seu-project-id.supabase.co"
```

No Vercel, cadastre essas mesmas variaveis em **Project Settings > Environment Variables**.

## Build

```bash
npm run build
```

O build gera a pasta `dist/`. Essa pasta nao precisa subir para o GitHub; o Vercel gera ela automaticamente.

## Vercel

Configuracao recomendada:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

## Supabase

Os arquivos do Supabase ficam em:

- `supabase/migrations`
- `supabase/functions`
- `supabase/config.toml`

Depois de conectar o projeto ao Supabase, aplique as migrations e publique as functions conforme a configuracao do seu projeto.
