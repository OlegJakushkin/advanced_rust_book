import { PAGES } from "./types"

const pageIndexCache = new Map<string, number>()

export function getPageIndexById(pageId: string): number {
  const cached = pageIndexCache.get(pageId)
  if (cached !== undefined) {
    return cached
  }

  const pageIndex = PAGES.findIndex((page) => page.id === pageId)
  if (pageIndex === -1) {
    throw new Error(`Unknown rust book page id: ${pageId}`)
  }

  pageIndexCache.set(pageId, pageIndex)
  return pageIndex
}
