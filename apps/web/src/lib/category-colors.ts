/** restrained, colour-blind-safe data hues per category (German flag-led palette). */
export const CATEGORY_COLOR: Record<string, string> = {
  Demography: "#C1121F",
  Labour: "#E8A200",
  Employment: "#2E6E68",
  Economy: "#B5561B",
  Income: "#6E7A2E",
  Housing: "#7A4A6B",
  Education: "#3F6B4F",
  Environment: "#4F7A3A",
  Agriculture: "#8A9A3B",
  Industry: "#555555",
  Mobility: "#9B3B6B",
  Infrastructure: "#C05A2E",
  Tourism: "#2E7D74",
  Health: "#B23A48",
  "Public finance": "#111111",
}

export function categoryColor(category?: string): string {
  return (category && CATEGORY_COLOR[category]) || "#C1121F"
}

/** same hue at reduced opacity, for tints and tracks */
export function categoryTint(category: string | undefined, alpha: number): string {
  const hex = categoryColor(category)
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex}${a}`
}
