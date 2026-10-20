// Keyword-based category suggestions for uncategorized transactions.
// Rules are checked in order; the first rule with a matching keyword wins.

export interface NewCategorySpec {
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

interface Rule {
  category: string;
  type: 'income' | 'expense';
  keywords: string[];
}

// Look of the categories that only exist once created (any other missing rule category gets a neutral look)
export const NEW_CATEGORIES: NewCategorySpec[] = [
  { name: 'Pets', type: 'expense', color: '#F59E0B', icon: 'paw-print' },
  { name: 'Cuidados Pessoais', type: 'expense', color: '#F472B6', icon: 'sparkles' },
  { name: 'Impostos e Taxas', type: 'expense', color: '#64748B', icon: 'receipt' },
  { name: 'Compras Online', type: 'expense', color: '#8B5CF6', icon: 'shopping-bag' },
  { name: 'Presentes', type: 'expense', color: '#EC4899', icon: 'gift' },
];

const RULES: Rule[] = [
  { category: 'Pagamento Emprestado', type: 'expense', keywords: ['mae', 'emprestimo', 'emprestado'] },
  { category: 'Cartão de Crédito', type: 'expense', keywords: ['fatura', 'cartao', 'nubank'] },
  { category: 'Assinaturas', type: 'expense', keywords: ['netflix', 'spotify', 'prime video', 'amazon prime', 'disney', 'hbo', 'youtube', 'icloud', 'google one', 'chatgpt', 'deezer', 'globoplay', 'assinatura', 'apple'] },
  { category: 'Moradia', type: 'expense', keywords: ['aluguel', 'condominio', 'luz', 'energia', 'enel', 'cpfl', 'cemig', 'agua', 'sabesp', 'gas', 'internet', 'wifi', 'vivo', 'claro', 'tim', 'iptu', 'diarista', 'faxina'] },
  { category: 'Transporte', type: 'expense', keywords: ['uber', '99', 'combustivel', 'gasolina', 'etanol', 'posto', 'estacionamento', 'pedagio', 'onibus', 'metro', 'ipva', 'licenciamento', 'oficina', 'mecanico', 'carro', 'moto'] },
  { category: 'Alimentação', type: 'expense', keywords: ['mercado', 'supermercado', 'ifood', 'restaurante', 'lanche', 'padaria', 'acougue', 'hortifruti', 'feira', 'pizza', 'hamburguer', 'delivery', 'rappi', 'cafe', 'almoco', 'jantar', 'atacadao', 'assai', 'carrefour', 'comida'] },
  { category: 'Saúde', type: 'expense', keywords: ['farmacia', 'drogaria', 'medico', 'consulta', 'exame', 'dentista', 'plano de saude', 'unimed', 'hospital', 'remedio', 'psicologo', 'terapia', 'academia', 'smartfit', 'smart fit'] },
  { category: 'Educação', type: 'expense', keywords: ['curso', 'faculdade', 'escola', 'livro', 'mensalidade', 'udemy', 'alura', 'ingles'] },
  { category: 'Lazer', type: 'expense', keywords: ['cinema', 'show', 'viagem', 'bar', 'festa', 'ingresso', 'hotel', 'airbnb', 'passeio', 'balada'] },
  { category: 'Roupas', type: 'expense', keywords: ['roupa', 'roupas', 'sapato', 'tenis', 'shein', 'renner', 'riachuelo', 'cea', 'zara'] },
  { category: 'Pets', type: 'expense', keywords: ['pet', 'petshop', 'racao', 'veterinario', 'vet'] },
  { category: 'Cuidados Pessoais', type: 'expense', keywords: ['cabelo', 'barbearia', 'barbeiro', 'cabeleireiro', 'salao', 'manicure', 'unha', 'estetica', 'perfume', 'cosmeticos', 'boticario', 'natura', 'sobrancelha'] },
  { category: 'Impostos e Taxas', type: 'expense', keywords: ['imposto', 'taxa', 'darf', 'das', 'mei', 'iof', 'tarifa', 'anuidade', 'juros', 'multa'] },
  { category: 'Compras Online', type: 'expense', keywords: ['amazon', 'mercado livre', 'shopee', 'magalu', 'aliexpress', 'temu'] },
  { category: 'Presentes', type: 'expense', keywords: ['presente', 'aniversario'] },
  { category: 'Pagamento Emprestado', type: 'income', keywords: ['mae', 'emprestimo', 'emprestado'] },
  { category: 'Salário', type: 'income', keywords: ['salario', 'holerite', 'adiantamento', 'clt'] },
  { category: 'Freelance', type: 'income', keywords: ['freela', 'freelance', 'job', 'projeto', 'servico'] },
  { category: 'Investimentos', type: 'income', keywords: ['rendimento', 'rendimentos', 'dividendo', 'dividendos', 'cdb', 'tesouro', 'juros'] },
];

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const hasKeyword = (text: string, keyword: string) => ` ${text} `.includes(` ${keyword} `);

export interface Suggestion {
  name: string; // category name to use
  isNew: boolean; // must be created first
}

// Suggested category for a description, preferring categories the user already has.
export function suggestCategory(
  description: string,
  type: 'income' | 'expense',
  existing: { name: string; type: string }[],
): Suggestion | null {
  const text = normalize(description);
  const has = (name: string) => existing.some(c => c.type === type && normalize(c.name) === normalize(name));
  for (const rule of RULES) {
    if (rule.type !== type || !rule.keywords.some(k => hasKeyword(text, k))) continue;
    if (has(rule.category)) return { name: existing.find(c => c.type === type && normalize(c.name) === normalize(rule.category))!.name, isNew: false };
    return { name: rule.category, isNew: true };
  }
  return null;
}
