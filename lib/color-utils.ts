/**
 * Convert a hex color (#rrggbb or #rgb) to HSL string
 * in the format used by CSS variables: "H S% L%" (no hsl() wrapper)
 */
export function hexToHsl(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return `0 0% ${Math.round(l * 100)}%`;

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Lighten an HSL string by adjusting the lightness */
export function lightenHsl(hsl: string, amount: number): string {
  const parts = hsl.split(' ');
  const l = parseInt(parts[2]);
  return `${parts[0]} ${parts[1]} ${Math.min(95, l + amount)}%`;
}

/** Darken an HSL string by adjusting the lightness */
export function darkenHsl(hsl: string, amount: number): string {
  const parts = hsl.split(' ');
  const l = parseInt(parts[2]);
  return `${parts[0]} ${parts[1]} ${Math.max(5, l - amount)}%`;
}
