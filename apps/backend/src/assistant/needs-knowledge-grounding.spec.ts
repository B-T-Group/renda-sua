import { needsKnowledgeGrounding } from './needs-knowledge-grounding';

describe('needsKnowledgeGrounding', () => {
  it('flags country and market coverage questions', () => {
    expect(needsKnowledgeGrounding('and brazil?')).toBe(true);
    expect(needsKnowledgeGrounding('Êtes-vous au Brésil ?')).toBe(true);
    expect(needsKnowledgeGrounding('Which markets do you serve?')).toBe(true);
    expect(needsKnowledgeGrounding('disponible au Canada ?')).toBe(true);
  });

  it('flags payment rails tied to a place', () => {
    expect(needsKnowledgeGrounding('Do you support Pix in Brazil?')).toBe(true);
    expect(needsKnowledgeGrounding('mobile money au Gabon')).toBe(true);
  });

  it('does not flag generic payment timing without a place', () => {
    expect(needsKnowledgeGrounding('do you support payment at delivery?')).toBe(
      false
    );
    expect(needsKnowledgeGrounding('merci')).toBe(false);
    expect(needsKnowledgeGrounding('est-ce disponible ?')).toBe(false);
  });
});
