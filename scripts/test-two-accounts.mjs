import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

for (const file of [".env.test", ".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const expectedProjectId = process.env.TEST_EXPECTED_PROJECT_ID;

const accounts = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
  supervisorA: {
    email: process.env.TEST_SUPERVISOR_A_EMAIL || process.env.TEST_USER_A_EMAIL,
    password: process.env.TEST_SUPERVISOR_A_PASSWORD || process.env.TEST_USER_A_PASSWORD,
  },
  supervisorB: {
    email: process.env.TEST_SUPERVISOR_B_EMAIL || process.env.TEST_USER_B_EMAIL,
    password: process.env.TEST_SUPERVISOR_B_PASSWORD || process.env.TEST_USER_B_PASSWORD,
  },
};

const missing = [
  !url && "VITE_SUPABASE_URL",
  !key && "VITE_SUPABASE_PUBLISHABLE_KEY",
  !expectedProjectId && "TEST_EXPECTED_PROJECT_ID",
  !accounts.admin.email && "TEST_ADMIN_EMAIL",
  !accounts.admin.password && "TEST_ADMIN_PASSWORD",
  !accounts.supervisorA.email && "TEST_SUPERVISOR_A_EMAIL",
  !accounts.supervisorA.password && "TEST_SUPERVISOR_A_PASSWORD",
  !accounts.supervisorB.email && "TEST_SUPERVISOR_B_EMAIL",
  !accounts.supervisorB.password && "TEST_SUPERVISOR_B_PASSWORD",
].filter(Boolean);

if (missing.length > 0) {
  console.error(`Configure as variaveis de homologacao: ${missing.join(", ")}.`);
  process.exit(1);
}

if (process.env.TEST_ALLOW_REMOTE_MUTATION !== "true") {
  console.error("Defina TEST_ALLOW_REMOTE_MUTATION=true somente no projeto de homologacao.");
  process.exit(1);
}

const projectIdFromUrl = new URL(url).hostname.split(".")[0];
if (projectIdFromUrl !== expectedProjectId) {
  console.error("TEST_EXPECTED_PROJECT_ID nao corresponde ao projeto Supabase configurado.");
  process.exit(1);
}

const clients = Object.fromEntries(
  Object.keys(accounts).map((name) => [
    name,
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  ]),
);

for (const [name, client] of Object.entries(clients)) {
  const { error } = await client.auth.signInWithPassword(accounts[name]);
  if (error) throw new Error(`Falha no login de ${name}: ${error.message}`);
}

const users = {};
for (const [name, client] of Object.entries(clients)) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error(`Nao foi possivel ler o usuario ${name}.`);
  users[name] = data.user;
}

if (new Set(Object.values(users).map((user) => user.id)).size !== 3) {
  throw new Error("As tres credenciais de teste precisam pertencer a contas diferentes.");
}

const { data: adminProfile, error: adminProfileError } = await clients.admin
  .from("profiles")
  .select("role,active")
  .eq("id", users.admin.id)
  .single();
if (adminProfileError || adminProfile?.role !== "admin" || !adminProfile.active) {
  throw new Error("A conta TEST_ADMIN_EMAIL nao possui perfil administrativo ativo.");
}

const token = `direct-rls-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const ids = {
  diaristaA: crypto.randomUUID(),
  diaristaB: crypto.randomUUID(),
  demandaA: crypto.randomUUID(),
  financeiroA: crypto.randomUUID(),
  loja: crypto.randomUUID(),
  templateAttempt: `test-${crypto.randomUUID()}`,
};

async function requireSuccess(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function expectInvisible(label, client, table, id) {
  const rows = await requireSuccess(label, await client.from(table).select("id").eq("id", id));
  if (rows.length !== 0) throw new Error(`${label}: registro privado ficou visivel.`);
}

async function expectVisible(label, client, table, id) {
  const rows = await requireSuccess(label, await client.from(table).select("id").eq("id", id));
  if (rows.length !== 1) throw new Error(`${label}: registro esperado nao ficou visivel.`);
}

try {
  await requireSuccess(
    "criar diarista A",
    await clients.supervisorA.from("diaristas").insert({
      id: ids.diaristaA,
      user_id: users.supervisorA.id,
      nome: `${token}-A`,
    }),
  );
  await requireSuccess(
    "criar diarista B",
    await clients.supervisorB.from("diaristas").insert({
      id: ids.diaristaB,
      user_id: users.supervisorB.id,
      nome: `${token}-B`,
    }),
  );

  await expectVisible("A le o proprio diarista", clients.supervisorA, "diaristas", ids.diaristaA);
  await expectInvisible("A nao le diarista B", clients.supervisorA, "diaristas", ids.diaristaB);
  await expectInvisible("B nao le diarista A", clients.supervisorB, "diaristas", ids.diaristaA);
  await expectVisible("admin le diarista A", clients.admin, "diaristas", ids.diaristaA);
  await expectVisible("admin le diarista B", clients.admin, "diaristas", ids.diaristaB);

  const today = new Date().toISOString().slice(0, 10);
  await requireSuccess(
    "criar demanda privada A",
    await clients.supervisorA.from("demandas").insert({
      id: ids.demandaA,
      user_id: users.supervisorA.id,
      data: today,
      codigo: token,
    }),
  );
  await requireSuccess(
    "criar financeiro privado A",
    await clients.supervisorA.from("registros_financeiros").insert({
      id: ids.financeiroA,
      user_id: users.supervisorA.id,
      data: today,
      diarista_nome: token,
    }),
  );

  await expectInvisible("B nao le demanda A", clients.supervisorB, "demandas", ids.demandaA);
  await expectInvisible("B nao le financeiro A", clients.supervisorB, "registros_financeiros", ids.financeiroA);
  await expectVisible("admin le demanda A", clients.admin, "demandas", ids.demandaA);
  await expectVisible("admin le financeiro A", clients.admin, "registros_financeiros", ids.financeiroA);

  await requireSuccess(
    "criar loja compartilhada",
    await clients.supervisorA.from("lojas").insert({
      id: ids.loja,
      user_id: users.supervisorA.id,
      nome: token,
      rede: "Teste automatizado",
      endereco: "Rua de homologacao, 1",
      responsavel: "Teste",
    }),
  );
  await expectVisible("B le loja compartilhada", clients.supervisorB, "lojas", ids.loja);
  await expectVisible("admin le loja compartilhada", clients.admin, "lojas", ids.loja);

  const forbiddenUpdate = await clients.supervisorB
    .from("lojas")
    .update({ bairro: "ALTERACAO-INDEVIDA" })
    .eq("id", ids.loja)
    .select("id");
  if (!forbiddenUpdate.error && forbiddenUpdate.data?.length) {
    throw new Error("Supervisor B conseguiu editar uma loja criada pelo Supervisor A.");
  }

  await requireSuccess(
    "admin edita loja compartilhada",
    await clients.admin
      .from("lojas")
      .update({ bairro: "Homologacao" })
      .eq("id", ids.loja)
      .select("id"),
  );

  const forbiddenTemplate = await clients.supervisorB.from("copy_templates").insert({
    id: ids.templateAttempt,
    user_id: users.supervisorB.id,
  });
  if (!forbiddenTemplate.error) {
    throw new Error("Supervisor conseguiu criar um modelo global de texto.");
  }

  console.log("OK: administrador, isolamento privado e catalogos compartilhados foram validados.");
} finally {
  await clients.admin.from("copy_templates").delete().eq("id", ids.templateAttempt);
  await clients.admin.from("lojas").delete().eq("id", ids.loja);
  await clients.supervisorA.from("demandas").delete().eq("id", ids.demandaA);
  await clients.supervisorA.from("registros_financeiros").delete().eq("id", ids.financeiroA);
  await clients.supervisorA.from("diaristas").delete().eq("id", ids.diaristaA);
  await clients.supervisorB.from("diaristas").delete().eq("id", ids.diaristaB);
  await Promise.all(Object.values(clients).map((client) => client.auth.signOut()));
}

