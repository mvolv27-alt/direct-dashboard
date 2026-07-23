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
const accountA = {
  email: process.env.TEST_SUPERVISOR_A_EMAIL,
  password: process.env.TEST_SUPERVISOR_A_PASSWORD,
};
const accountB = {
  email: process.env.TEST_SUPERVISOR_B_EMAIL,
  password: process.env.TEST_SUPERVISOR_B_PASSWORD,
};

if (!url || !key || !expectedProjectId || !accountA.email || !accountA.password || !accountB.email || !accountB.password) {
  throw new Error("Configure o projeto e as duas contas de homologacao em .env.test.");
}
if (process.env.TEST_ALLOW_REMOTE_MUTATION !== "true") {
  throw new Error("Defina TEST_ALLOW_REMOTE_MUTATION=true somente durante a homologacao.");
}
if (new URL(url).hostname.split(".")[0] !== expectedProjectId) {
  throw new Error("O projeto configurado nao corresponde a TEST_EXPECTED_PROJECT_ID.");
}

const createTestClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });

const writerA = createTestClient();
const readerA = createTestClient();
const readerB = createTestClient();
const clients = [writerA, readerA, readerB];

async function login(client, account, label) {
  const { error } = await client.auth.signInWithPassword(account);
  if (error) throw new Error(`Falha no login ${label}: ${error.message}`);
}

function waitForSubscription(channel, label) {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout ao assinar ${label}.`)), 20_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolvePromise();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(new Error(`Falha na assinatura ${label}: ${status}.`));
      }
    });
  });
}

await login(writerA, accountA, "writer A");
await login(readerA, accountA, "reader A");
await login(readerB, accountB, "reader B");

const { data: userResult, error: userError } = await writerA.auth.getUser();
if (userError || !userResult.user) throw new Error("Nao foi possivel identificar o supervisor A.");

const id = crypto.randomUUID();
const token = `direct-realtime-${Date.now()}`;
const ownerFilter = `user_id=eq.${userResult.user.id}`;
let receivedByA = false;
let leakedToB = false;

const channelA = readerA
  .channel(`direct-realtime-a-${crypto.randomUUID()}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "diaristas", filter: ownerFilter },
    (payload) => {
      if (payload.new?.id === id) receivedByA = true;
    },
  );
const channelB = readerB
  .channel(`direct-realtime-b-${crypto.randomUUID()}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "diaristas", filter: ownerFilter },
    (payload) => {
      if (payload.new?.id === id) leakedToB = true;
    },
  );

try {
  await Promise.all([
    waitForSubscription(channelA, "reader A"),
    waitForSubscription(channelB, "reader B"),
  ]);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));

  const { error: insertError } = await writerA.from("diaristas").insert({
    id,
    user_id: userResult.user.id,
    nome: token,
  });
  if (insertError) throw new Error(`Falha ao criar evento Realtime: ${insertError.message}`);

  const deadline = Date.now() + 15_000;
  while (!receivedByA && Date.now() < deadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));

  if (!receivedByA) throw new Error("A segunda sessao do supervisor A nao recebeu a atualizacao.");
  if (leakedToB) throw new Error("O evento privado vazou para o supervisor B.");

  console.log("OK: Realtime sincronizou a mesma conta sem vazar para outro supervisor.");
} finally {
  await writerA.from("diaristas").delete().eq("id", id);
  await Promise.all([
    readerA.removeChannel(channelA),
    readerB.removeChannel(channelB),
  ]);
  await Promise.all(clients.map((client) => client.auth.signOut()));
}
