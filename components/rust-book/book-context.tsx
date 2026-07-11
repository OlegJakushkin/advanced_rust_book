"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { PAGES, DEFAULT_CODES, BookState } from "./types"
import { trackChapterView } from "@/lib/analytics"

const STORAGE_KEY = "rust-book-state"

function clampPageIndex(page: number): number {
  const maxPageIndex = Math.max(PAGES.length - 1, 0)
  return Math.min(Math.max(page, 0), maxPageIndex)
}

function normalizeCompletedPages(pages: number[]): number[] {
  return Array.from(
    new Set(pages.filter((page) => page >= 0 && page < PAGES.length))
  ).sort((left, right) => left - right)
}

interface BookContextValue {
  currentPage: number
  setCurrentPage: (page: number) => void
  completedPages: number[]
  markPageComplete: (page: number) => void
  codes: Record<string, string>
  updateCode: (key: string, code: string) => void
  resetCode: (key: string) => void
  resetAllCodes: () => void
  outputs: Record<string, string | null>
  setOutput: (key: string, output: string | null) => void
  isRunning: string | null
  setIsRunning: (key: string | null) => void
  totalPages: number
  showToc: boolean
  setShowToc: (show: boolean) => void
}

const BookContext = createContext<BookContextValue | null>(null)

export function useBook() {
  const ctx = useContext(BookContext)
  if (!ctx) throw new Error("useBook must be used within BookProvider")
  return ctx
}

interface BookProviderProps {
  children: ReactNode
}

export function BookProvider({ children }: BookProviderProps) {
  const [currentPage, setCurrentPageState] = useState(0)
  const [completedPages, setCompletedPages] = useState<number[]>([])
  const [codes, setCodes] = useState<Record<string, string>>(DEFAULT_CODES)
  const [outputs, setOutputs] = useState<Record<string, string | null>>({})
  const [isRunning, setIsRunning] = useState<string | null>(null)
  const [showToc, setShowToc] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const state = JSON.parse(saved) as BookState
        setCurrentPageState(clampPageIndex(state.currentPage ?? 0))
        setCompletedPages(normalizeCompletedPages(state.completedPages ?? []))

        if (state.codes) {
          setCodes({ ...DEFAULT_CODES, ...state.codes })
        }
      }
    } catch {
      // Ignore errors
    }
    setIsHydrated(true)
  }, [])

  // Save state to localStorage
  const saveState = useCallback(() => {
    if (!isHydrated) return
    try {
      const state: BookState = {
        currentPage,
        completedPages,
        codes,
        outputs: {},
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore errors
    }
  }, [currentPage, completedPages, codes, isHydrated])

  useEffect(() => {
    saveState()
  }, [saveState])

  // Attribute analytics to the active chapter and emit an SPA page_view whenever
  // the reader navigates (the URL never changes, so gtag cannot detect this itself).
  useEffect(() => {
    const page = PAGES[currentPage]
    if (page) {
      trackChapterView({ index: currentPage, title: page.title, id: page.id })
    }
  }, [currentPage])

  const setCurrentPage = useCallback((page: number) => {
    const nextPage = clampPageIndex(page)
    setCurrentPageState(nextPage)

    if (nextPage > 0) {
      setCompletedPages((prev) =>
        normalizeCompletedPages([
          ...prev,
          ...Array.from({ length: nextPage }, (_, index) => index),
        ])
      )
    }
  }, [])

  const markPageComplete = useCallback((page: number) => {
    if (page < 0 || page >= PAGES.length) return
    setCompletedPages((prev) => normalizeCompletedPages([...prev, page]))
  }, [])

  const updateCode = useCallback((key: string, code: string) => {
    setCodes((prev) => ({ ...prev, [key]: code }))
  }, [])

  const resetCode = useCallback((key: string) => {
    if (DEFAULT_CODES[key]) {
      setCodes(prev => ({ ...prev, [key]: DEFAULT_CODES[key] }))
    }
  }, [])

  const resetAllCodes = useCallback(() => {
    setCodes(DEFAULT_CODES)
    setOutputs({})
    setIsRunning(null)
  }, [])

  const setOutput = useCallback((key: string, output: string | null) => {
    setOutputs((prev) => ({ ...prev, [key]: output }))
  }, [])

  return (
    <BookContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        completedPages,
        markPageComplete,
        codes,
        updateCode,
        resetCode,
        resetAllCodes,
        outputs,
        setOutput,
        isRunning,
        setIsRunning,
        totalPages: PAGES.length,
        showToc,
        setShowToc,
      }}
    >
      {children}
    </BookContext.Provider>
  )
}
