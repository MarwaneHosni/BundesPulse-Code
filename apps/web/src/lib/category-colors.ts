/** restrained, colour-blind-safe data hues per category (German warm palette). */
export const CATEGORY_COLOR: Record<string, string> = {
  Demography: "#8C1418",
  Labour: "#B8860B",
  Employment: "#2E6E68",
  Economy: "#A5541E",
  Income: "#6E7A2E",
  Housing: "#7A4A6B",
  Education: "#3F6B4F",
  Environment: "#4F7A3A",
  Agriculture: "#8A9A3B",
  Industry: "#6B5B4A",
  Mobility: "#9B3B6B",
  Infrastructure: "#C05A2E",
  Tourism: "#2E7D74",
  Health: "#B23A48",
  "Public finance": "#4A4A4A",
}

export function categoryColor(category?: string): string {
  return (category && CATEGORY_COLOR[category]) || "#8C1418"
}

/** same hue at reduced opacity, for tints and tracks */
export function categoryTint(category: string | undefined, alpha: number): string {
  const hex = categoryColor(category)
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex}${a}`
}
