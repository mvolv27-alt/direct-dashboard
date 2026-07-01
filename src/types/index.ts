export interface Diarista {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  bairro: string;
  setorExperiencia: string[];
  presencas: number;
  faltas: number;
  createdAt: string;
}

export function calcularAvaliacao(presencas: number, faltas: number): number {
  const total = presencas + faltas;
  if (total === 0) return 0;
  const ratio = presencas / total;
  return Math.max(1, Math.round(ratio * 5));
}

export interface RegistroFinanceiro {
  id: string;
  diaristaId: string;
  diaristaNome: string;
  loja: string;
  data: string;
  horarioEntrada: string;
  horarioSaida: string;
  setor: string;
  valorDiaria: number;
  passagem: number;
  adiantamento: number;
  custosAdicionais: number;
  pago: boolean;
  pagoEm: string | null;
  observacoes: string;
  createdAt: string;
}

export type DemandaStatus = "pendente" | "em_andamento" | "concluida" | "falta";

export type DemandaAlocacaoStatus = "pendente" | "presente" | "falta";

export interface DemandaReposicao {
  diaristaId?: string;
  diaristaNome: string;
  telefone?: string;
  observacoes?: string;
  criadoEm: string;
}

export interface DemandaAlocacao {
  id: string;
  diaristaId: string;
  diaristaNome: string;
  status: DemandaAlocacaoStatus;
  marcadoEm?: string;
  reposicao?: DemandaReposicao;
}

export interface Demanda {
  id: string;
  codigo: string;
  data: string;
  horario: string;
  horarioSaida?: string;
  rede: string;
  loja: string;
  setor: string;
  valor: number;
  diaristaId?: string;
  diaristaNome?: string;
  alocacoes?: DemandaAlocacao[];
  // legacy/optional
  cliente?: string;
  unidade?: string;
  endereco?: string;
  tarefasTotal: number;
  tarefasConcluidas: number;
  status: DemandaStatus;
  checkInAt?: string;
  checkInBy?: string;
  observacoes?: string;
  createdAt: string;
}
