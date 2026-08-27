export type CreateNamedOption = {
  id: 'create-new';
  name: string;
  isCreateOption: true;
  createValue: string;
};

export function isCreateNamedOption(value: unknown): value is CreateNamedOption {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isCreateOption' in value &&
    (value as CreateNamedOption).isCreateOption === true
  );
}

export function filterWithCreateOption<T extends { name: string }>(
  options: T[],
  inputValue: string,
  addLabel: (name: string) => string
): Array<T | CreateNamedOption> {
  const trimmed = inputValue.trim();
  const query = trimmed.toLowerCase();
  const filtered = query
    ? options.filter((option) => option.name.toLowerCase().includes(query))
    : options;
  const exists = options.some((option) => option.name.toLowerCase() === query);
  if (!trimmed || exists) return filtered;
  return [
    ...filtered,
    {
      id: 'create-new',
      name: addLabel(trimmed),
      isCreateOption: true,
      createValue: trimmed,
    },
  ];
}
