"use client"

import { useState, type ElementType } from "react"
import { BookOpen, Code2, Trophy, Package, Network, Check, ChevronRight, ChevronDown, X, RotateCcw } from "lucide-react"
import { useBook } from "./book-context"
import { CHAPTERS, PAGES, getPageIndicesForChapter } from "./types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const ICONS: Record<string, ElementType> = {
  book: BookOpen,
  code: Code2,
  trophy: Trophy,
  package: Package,
  network: Network,
}

export function TableOfContents() {
  const { 
    currentPage, 
    setCurrentPage, 
    completedPages, 
    showToc, 
    setShowToc,
    resetAllCodes 
  } = useBook()

  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(() => {
    // Start with all chapters expanded
    return new Set(CHAPTERS.map((_, i) => i))
  })

  if (!showToc) return null

  const toggleChapter = (chapterIndex: number) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      if (next.has(chapterIndex)) {
        next.delete(chapterIndex)
      } else {
        next.add(chapterIndex)
      }
      return next
    })
  }

  const isChapterCompleted = (chapterIndex: number) => {
    const pageIndices = getPageIndicesForChapter(chapterIndex)
    return pageIndices.every(i => completedPages.includes(i))
  }

  const getChapterProgress = (chapterIndex: number) => {
    const pageIndices = getPageIndicesForChapter(chapterIndex)
    const completed = pageIndices.filter(i => completedPages.includes(i)).length
    return { completed, total: pageIndices.length }
  }

  let globalPageIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Table of Contents</h2>
              <p className="text-xs text-muted-foreground">
                {completedPages.length} of {PAGES.length} pages completed
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowToc(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(completedPages.length / PAGES.length) * 100}%` }}
          />
        </div>

        {/* Chapter List */}
        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {CHAPTERS.map((chapter, chapterIndex) => {
            const ChapterIcon = ICONS[chapter.icon] || BookOpen
            const isExpanded = expandedChapters.has(chapterIndex)
            const chapterCompleted = isChapterCompleted(chapterIndex)
            const { completed, total } = getChapterProgress(chapterIndex)
            const startPageIndex = globalPageIndex
            const isPart = chapter.id.startsWith("part-")

            return (
              <div key={chapter.id} className="mb-1">
                {/* Chapter Header */}
                <button
                  onClick={() => toggleChapter(chapterIndex)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    isPart ? "mt-3 bg-primary/10 hover:bg-primary/15 border border-primary/20" : "hover:bg-muted/80",
                    !isPart && chapterCompleted && "bg-primary/5"
                  )}
                >
                  {/* Expand/Collapse Icon */}
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Chapter Icon */}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    chapterCompleted ? "bg-primary/20" : "bg-muted"
                  )}>
                    {chapterCompleted ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <ChapterIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Chapter Title */}
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-semibold text-sm",
                      isPart ? "text-primary uppercase tracking-wide" : chapterCompleted ? "text-primary" : "text-foreground"
                    )}>
                      {chapter.title}
                    </div>
                    {!isPart && (
                      <div className="text-xs text-muted-foreground">
                        {completed}/{total} pages completed
                      </div>
                    )}
                  </div>

                  {/* Progress Indicator */}
                  {!isPart && (
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(completed / total) * 100}%` }}
                      />
                    </div>
                  )}
                </button>

                {/* Pages */}
                {isExpanded && (
                  <div className="ml-8 pl-3 border-l-2 border-muted">
                    {chapter.pages.map((page, pageInChapter) => {
                      const pageIndex = startPageIndex + pageInChapter
                      const PageIcon = ICONS[page.icon] || BookOpen
                      const isCompleted = completedPages.includes(pageIndex)
                      const isCurrent = currentPage === pageIndex

                      // Update global page index tracker
                      if (pageInChapter === chapter.pages.length - 1) {
                        globalPageIndex = startPageIndex + chapter.pages.length
                      }

                      return (
                        <button
                          key={page.id}
                          onClick={() => {
                            setCurrentPage(pageIndex)
                            setShowToc(false)
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors",
                            isCurrent 
                              ? "bg-primary/10 text-foreground" 
                              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {/* Status Indicator */}
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                            isCompleted 
                              ? "bg-primary text-primary-foreground" 
                              : isCurrent
                                ? "bg-primary/20 text-primary ring-2 ring-primary"
                                : "bg-muted text-muted-foreground"
                          )}>
                            {isCompleted ? <Check className="h-3 w-3" /> : pageIndex + 1}
                          </div>

                          {/* Page Icon */}
                          <PageIcon className={cn(
                            "h-4 w-4 shrink-0",
                            isCurrent ? "text-primary" : "text-muted-foreground"
                          )} />

                          {/* Page Info */}
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "text-sm truncate",
                              isCurrent && "font-medium"
                            )}>
                              {page.title}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {page.description}
                            </div>
                          </div>

                          {/* Current Indicator */}
                          {isCurrent && (
                            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Completion Banner */}
        {completedPages.length === PAGES.length && (
          <div className="mx-2 mb-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-primary font-medium text-sm">
              <Trophy className="h-4 w-4" />
              Congratulations! You&apos;ve completed the book!
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Reset all code to defaults? Your edits will be lost.")) {
                resetAllCodes()
              }
            }}
            className="w-full gap-2 text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All Code to Defaults
          </Button>
        </div>
      </div>
    </div>
  )
}
