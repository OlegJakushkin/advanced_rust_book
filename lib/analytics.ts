// Google Analytics 4 (gtag.js) integration for the statically-exported book.
//
// The measurement id is supplied at build time via NEXT_PUBLIC_GA_ID (inlined by
// Next into the static export). When it is empty the whole integration is inert:
// the <Script> tags are not emitted and every helper below is a no-op, so local
// development and unconfigured builds behave exactly as before.
export const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim()
export const GA_ENABLED = GA_MEASUREMENT_ID.length > 0

type GtagParams = Record<string, string | number | boolean | undefined>

interface ActiveChapter {
  index: number
  title: string
  id: string
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
    __bookChapter__?: ActiveChapter
  }
}

// Remember which chapter the reader is on so that every subsequent event
// (notably each "Run" click) is attributed to the right chapter, even though
// this is a single-page app where the URL never changes.
export function setActiveChapter(chapter: ActiveChapter): void {
  if (typeof window === "undefined") return
  window.__bookChapter__ = chapter
}

export function trackEvent(name: string, params: GtagParams = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return
  const chapter = window.__bookChapter__
  window.gtag("event", name, {
    ...(chapter
      ? { chapter_title: chapter.title, chapter_id: chapter.id, chapter_index: chapter.index }
      : {}),
    ...params,
  })
}

// Client-side page_view for SPA chapter changes (gtag's automatic page_view only
// fires on the initial load because the route never changes afterwards).
export function trackChapterView(chapter: ActiveChapter): void {
  setActiveChapter(chapter)
  if (typeof window === "undefined" || typeof window.gtag !== "function") return
  window.gtag("event", "page_view", {
    page_title: chapter.title,
    page_location: window.location.href,
    chapter_id: chapter.id,
    chapter_index: chapter.index,
  })
  trackEvent("chapter_view", { chapter_id: chapter.id })
}

// Fired on every "Run" click in a code editor — both chapter example listings and
// exercise practice cards route through this so all runs are captured.
export function trackRun(params: { snippet: string; kind: "chapter" | "exercise"; key?: string; editable: boolean }): void {
  trackEvent(params.kind === "exercise" ? "run_exercise" : "run_snippet", {
    snippet: params.snippet,
    snippet_key: params.key,
    editable: params.editable,
  })
}
