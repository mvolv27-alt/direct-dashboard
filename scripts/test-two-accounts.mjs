import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const accounts = [
  { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD },
  { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD },
];

if (!url || !key || accounts.some((account) => !account.email || !account.password)) {
  console.error("Defina VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY e TEST_USER_A/B_EMAIL/PASSWORD.");
  process.exit(1);
}

const clients = accounts.map(() => createClient(url, key, { auth: { persistSession: false } }));
for (let index = 0; index < clients.length; index += 1) {
  const { error } = await clients[index].auth.signInWithPassword(accounts[index]);
  if (error) throw new Error(`Falha no login da conta ${index + 1}: ${error.message}`);
}

const token = `isolation-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const privateIds = [crypto.randomUUID(), crypto.randomUUID()];
const privateDemandId = crypto.randomUUID();
const privateFinanceId = crypto.randomUUID();
const sharedStoreId = crypto.randomUUID();

async function assertNoError(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

try {
  for (let index = 0; index < clients.length; index += 1) {
    const { data: authData } = await clients[index].auth.getUser();
    await assertNoError(
      `criar diarista da conta ${index + 1}`,
      await clients[index].from("diaristas").insert({
        id: privateIds[index],
        user_id: authData.user.id,
        nome: `${token}-conta-${index + 1}`,
      }),
    );
  }

  const ownA = await assertNoError("ler registro próprio A", await clients[0].from("diaristas").select("id").eq("id", privateIds[0]));
  const leakAtoB = await assertNoError("testar vazamento A para B", await clients[1].from("diaristas").select("id").eq("id", privateIds[0]));
  const leakBtoA = await assertNoError("testar vazamento B para A", await clients[0].from("diaristas").select("id").eq("id", privateIds[1]));
  if (ownA.length !== 1 || leakAtoB.length !== 0 || leakBtoA.length !== 0) {
    throw new Error("Falha de isolamento: uma conta conseguiu ler o cadastro privado da outra.");
  }

  const { data: userA } = await clients[0].auth.getUser();
  await assertNoError("criar demanda privada A", await clients[0].from("demandas").insert({
    id: privateDemandId,
    user_id: userA.user.id,
    data: new Date().toISOString().slice(0, 10),
    codigo: token,
  }));
  await assertNoError("criar financeiro privado A", await clients[0].from("registros_financeiros").insert({
    id: privateFinanceId,
    user_id: userA.user.id,
    data: new Date().toISOString().slice(0, 10),
    diarista_nome: token,
  }));
  const demandLeak = await assertNoError("testar demanda A para B", await clients[1].from("demandas").select("id").eq("id", privateDemandId));
  const financeLeak = await assertNoError("testar financeiro A para B", await clients[1].from("registros_financeiros").select("id").eq("id", privateFinanceId));
  if (demandLeak.length !== 0 || financeLeak.length !== 0) {
    throw new Error("Falha de isolamento em demandas ou financeiro.");
  }

  await assertNoError("criar loja compartilhada", await clients[0].from("lojas").insert({
    id: sharedStoreId,
    user_id: userA.user.id,
    nome: token,
    rede: "Teste automatizado",
    endereco: "Rua do teste, 1",
    responsavel: "Teste",
  }));
  const sharedForB = await assertNoError("ler loja compartilhada pela conta B", await clients[1].from("lojas").select("id").eq("id", sharedStoreId));
  if (sharedForB.length !== 1) throw new Error("Falha de compartilhamento: a segunda conta não viu a loja.");

  console.log("OK: dados privados isolados e cadastros de lojas compartilhados entre duas contas.");
} finally {
  await clients[0].from("lojas").delete().eq("id", sharedStoreId);
  await clients[0].from("demandas").delete().eq("id", privateDemandId);
  await clients[0].from("registros_financeiros").delete().eq("id", privateFinanceId);
  await clients[0].from("diaristas").delete().eq("id", privateIds[0]);
  await clients[1].from("diaristas").delete().eq("id", privateIds[1]);
  await Promise.all(clients.map((client) => client.auth.signOut()));
}
