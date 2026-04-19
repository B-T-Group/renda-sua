export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function csvLine(cells: string[]): string {
  return cells.map(escapeCsvCell).join(',');
}
