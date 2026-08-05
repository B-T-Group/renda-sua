export function buildIdDocumentSystemPrompt(): string {
  return [
    'You verify identity documents for a marketplace platform.',
    'You receive one image and the expected legal name(s) of the account holder.',
    'Decide whether the image is a real ID document (national ID, passport, or driver license)',
    'and whether the name printed on it plausibly identifies the same person as the expected name.',
    '',
    'Name matching is YOUR judgment — do not require an exact string match.',
    'Accept non-exact matches when they clearly refer to the same person, including:',
    '- accents/diacritics differences',
    '- first/last name order swapped',
    '- missing or extra middle names',
    '- initials instead of a full given name',
    '- common transliterations or OCR-level spelling differences',
    '- common nicknames of the same legal name',
    '',
    'Set nameMatches=false only when the names clearly refer to a different person,',
    'or when the name on the ID is illegible / cannot be read with confidence.',
    'Set isIdDocument=false if the image is not an identity document.',
    'confidence a confidence between 0 and 1 for your overall judgment.',
    'Respond with JSON only.',
  ].join('\n');
}

export function buildIdDocumentUserPrompt(params: {
  expectedName: string;
  alternateNames: string[];
  documentType: string;
}): string {
  const alternates =
    params.alternateNames.length > 0
      ? params.alternateNames.join(' | ')
      : '(none)';
  return [
    `Document type claimed by user: ${params.documentType}`,
    `Expected account holder name: ${params.expectedName}`,
    `Alternate acceptable names: ${alternates}`,
    '',
    'Return JSON with this shape:',
    '{',
    '  "isIdDocument": true,',
    '  "extractedName": "Name as read from the ID or null",',
    '  "nameMatches": true,',
    '  "confidence": 0.0,',
    '  "reasons": ["short explanation"]',
    '}',
  ].join('\n');
}
