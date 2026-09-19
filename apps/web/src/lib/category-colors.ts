/** restrained, colour-blind-safe data hues per category (OECD-style accents). */
export const CATEGORY_COLOR: Record<string, string> = {
  Demography: "#3E6FB0",
  Labour: "#B8822E",
  Employment: "#2E8B8B",
  Economy: "#B4703A",
  Income: "#6E8B3D",
  Housing: "#8A5A9B",
  Education: "#3F8F4E",
  Environment: "#4E9A6B",
  Agriculture: "#7E8A3B",
  Industry: "#7A6A5A",
  Mobility: "#8A5A9B",
  Infrastructure: "#C05A2E",
  Tourism: "#2E8B8B",
  Health: "#C0555A",
  "Public finance": "#5A6A8A",
}

export function categoryColor(category?: string): string {
  return (category && CATEGORY_COLOR[category]) || "#1c6db0"
}

/** same hue at reduced opacity, for tints and tracks */
export function categoryTint(category: string | undefined, alpha: number): string {
  const hex = categoryColor(category)
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `${hex}${a}`
}
