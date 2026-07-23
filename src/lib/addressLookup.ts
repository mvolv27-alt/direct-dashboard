import { normalizarBusca } from "@/lib/solicitacaoAgent";

export type SugestaoEndereco = {
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  latitude: string;
  longitude: string;
  mapaUrl: string;
};

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    "ISO3166-2-lvl4"?: string;
  };
};

const CACHE_PREFIX = "direct.address-lookup::";
const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org/search";

function readCache(key: string) {
  if (typeof localStorage === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || "null") as SugestaoEndereco | null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: SugestaoEndereco) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* cache unavailable */
  }
}

function montarEndereco(item: NominatimResult) {
  const address = item.address || {};
  const via = address.road || address.pedestrian || "";
  const endereco = [via, address.house_number].filter(Boolean).join(", ");
  if (endereco) return endereco;
  return String(item.display_name || "").split(",").slice(0, 2).join(",").trim();
}

export async function buscarEnderecoLoja(
  dados: { rede: string; loja: string; bairro: string; cidade?: string; uf?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SugestaoEndereco | null> {
  const cidade = dados.cidade?.trim() || "Fortaleza";
  const uf = dados.uf?.trim() || "CE";
  const termoLoja = dados.loja.trim() || [dados.rede, dados.bairro].filter(Boolean).join(" ");
  if (!termoLoja) return null;

  const query = [termoLoja, cidade, uf, "Brasil"].filter(Boolean).join(", ");
  const cacheKey = normalizarBusca(query);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const endpoint = import.meta.env?.VITE_GEOCODING_URL || DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "3");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("viewbox", "-38.70,-3.65,-38.35,-3.95");
  url.searchParams.set("bounded", "1");

  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("O serviço de mapas não respondeu.");

  const results = (await response.json()) as NominatimResult[];
  const item = results.find((result) => montarEndereco(result)) || null;
  if (!item) return null;

  const address = item.address || {};
  const isoUf = address["ISO3166-2-lvl4"]?.split("-").pop();
  const suggestion: SugestaoEndereco = {
    endereco: montarEndereco(item),
    bairro:
      address.suburb ||
      address.neighbourhood ||
      address.quarter ||
      address.city_district ||
      dados.bairro,
    cidade: address.city || address.town || address.municipality || cidade,
    uf: isoUf || uf,
    latitude: item.lat || "",
    longitude: item.lon || "",
    mapaUrl:
      item.lat && item.lon
        ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(item.lat)}&mlon=${encodeURIComponent(item.lon)}#map=18/${encodeURIComponent(item.lat)}/${encodeURIComponent(item.lon)}`
        : "https://www.openstreetmap.org/",
  };
  writeCache(cacheKey, suggestion);
  return suggestion;
}
