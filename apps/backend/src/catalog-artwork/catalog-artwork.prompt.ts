export function buildCatalogArtworkPrompt(input: {
  name: string;
  description?: string | null;
  kind: 'category' | 'collection';
}): string {
  const detail = input.description?.trim();
  const subject = detail ? `${input.name}. ${detail}` : input.name;
  return [
    `Square catalog cover for a marketplace ${input.kind}: ${subject}.`,
    'Clean product photography, no text, no logos, no watermarks,',
    'soft natural light, centered subject, calm background.',
  ].join(' ');
}
