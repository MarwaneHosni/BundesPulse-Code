import { describe, expect, it } from "vitest"
import { cn } from "@/lib/utils"

describe("cn", () => {
  it("merges class names with tailwind-merge", () => {
    expect(cn("a", "b")).toBe("a b")
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})