export const ACCENT_COLOURS = [
  { value: '#4F46E5', label: 'Indigo' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#2563EB', label: 'Blue' },
  { value: '#0284C7', label: 'Sky' },
  { value: '#0D9488', label: 'Teal' },
  { value: '#16A34A', label: 'Green' },
  { value: '#EA580C', label: 'Orange' },
  { value: '#E11D48', label: 'Rose' },
  { value: '#DB2777', label: 'Pink' },
  { value: '#475569', label: 'Slate' },
] as const;

export const DEFAULT_ACCENT_COLOUR = ACCENT_COLOURS[0].value;

export function validAccentColour(value: string): boolean {
  return ACCENT_COLOURS.some((option) => option.value === value);
}
