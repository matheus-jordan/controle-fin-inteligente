import { describe, it, expect } from 'vitest';
import { suggestCategory } from './autoCategory';

const existing = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Assinaturas', 'Lazer', 'Cartão de Crédito', 'Outros Despesas']
  .map(name => ({ name, type: 'expense' }))
  .concat([{ name: 'Salário', type: 'income' }]);

describe('suggestCategory', () => {
  it('uses existing categories, ignoring case and accents', () => {
    expect(suggestCategory('Supermercado Assaí', 'expense', existing)).toEqual({ name: 'Alimentação', isNew: false });
    expect(suggestCategory('NETFLIX', 'expense', existing)).toEqual({ name: 'Assinaturas', isNew: false });
    expect(suggestCategory('Conta de luz', 'expense', existing)).toEqual({ name: 'Moradia', isNew: false });
    expect(suggestCategory('Salário outubro', 'income', existing)).toEqual({ name: 'Salário', isNew: false });
  });

  it('matches whole words only', () => {
    expect(suggestCategory('Gasolina', 'expense', existing)).toEqual({ name: 'Transporte', isNew: false });
    expect(suggestCategory('Barzinho', 'expense', existing)).toBeNull();
  });

  it('suggests a new category when none of the existing ones fits', () => {
    expect(suggestCategory('Ração do Thor', 'expense', existing)).toEqual({ name: 'Pets', isNew: true });
    expect(suggestCategory('Barbearia', 'expense', existing)).toEqual({ name: 'Cuidados Pessoais', isNew: true });
  });

  it('suggests creating a known category the user does not have', () => {
    expect(suggestCategory('Empréstimo mãe', 'expense', existing)).toEqual({ name: 'Pagamento Emprestado', isNew: true });
  });

  it('returns null when nothing matches', () => {
    expect(suggestCategory('Pix João', 'expense', existing)).toBeNull();
  });
});
