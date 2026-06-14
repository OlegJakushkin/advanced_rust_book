"use client"

import { useEffect } from "react"
import { ArrowLeft, BookOpen, CheckCircle2, Code2, Lightbulb, Target, Trophy } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { Button } from "@/components/ui/button"

interface SingleExampleExercisePageProps {
  pageId: string
}

function createExercisePage(pageId: string) {
  return function GeneratedSingleExampleExercisePage() {
    return <SingleExampleExercisePage pageId={pageId} />
  }
}

function chapterNumberFromId(pageId: string): string {
  return pageId.match(/^ch(\d+)/)?.[1] ?? "??"
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function prettifyCodeKey(codeKey: string | undefined): string {
  if (!codeKey) {
    return "chapter example"
  }

  return titleCase(codeKey.replace(/_/g, " "))
}

function fallbackSolutionCode(pageTitle: string): string {
  const safeTitle = pageTitle.replace(/\\/g, "\\\\").replace(/"/g, '\\"')

  return `fn main() {
    println!("Complete the focused example for ${safeTitle}");
}`
}

function SingleExampleExercisePage({ pageId }: SingleExampleExercisePageProps) {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById(pageId)
  const mainPageId = pageId.replace(/-exercises$/, "")
  const mainPageIndex = getPageIndexById(mainPageId)
  const page = PAGES[pageIndex]
  const mainPage = PAGES[mainPageIndex]
  const chapterNumber = chapterNumberFromId(pageId)
  const codeKey = mainPage.codeKeys?.[0]
  const concept = prettifyCodeKey(codeKey)
  const solutionCode = (codeKey ? DEFAULT_CODES[codeKey] : undefined) ?? fallbackSolutionCode(page.title)
  const solutionFileName = `${mainPageId}-example.rs`

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter {chapterNumber} · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          This exercise page is intentionally focused: one example case, one complete openable solution, and one detailed
          explanation of what the solution does, how it works, and why it is the right shape for the chapter.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this exercise</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Read the chapter&apos;s runnable <span className="font-medium text-foreground">{concept}</span> example,
                explain its ownership and boundary choices, then compare your reasoning against the complete solution
                below.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter {chapterNumber}
            </Button>
          </div>
        </section>

        <article className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3 flex-col md:flex-row md:items-center mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Example exercise · {concept}</div>
              <h3 className="text-lg font-semibold text-foreground">{mainPage.title}</h3>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-foreground">Objective</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Understand the example as production-shaped Rust: identify the owned data, the borrowed views, the
                boundary where work is handed off, and the minimal abstraction that keeps the code reviewable.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-foreground">Starter prompt</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-6">{mainPage.description}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h4 className="font-medium text-foreground mb-2">Acceptance criteria</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>You can state what the example owns and what it only borrows.</li>
              <li>You can identify the Rust feature or standard-library type doing the main work.</li>
              <li>You can explain why the solution avoids unnecessary global state, hidden mutation, or fake lifetimes.</li>
              <li>You can run or inspect the complete solution without needing any omitted helper code.</li>
            </ul>
          </div>

          <details className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <summary className="cursor-pointer list-none flex items-center gap-2 font-medium text-foreground">
              <Lightbulb className="h-4 w-4 text-primary" />
              Show the complete solution and explanation
            </summary>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Code2 className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-foreground">Complete solution · {solutionFileName}</h4>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-5 text-foreground">
                  <code>{solutionCode}</code>
                </pre>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-foreground">Detailed explainer</h4>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground leading-6">
                  <p>
                    <span className="font-medium text-foreground">What it is:</span> this is the complete chapter example
                    for <span className="font-medium text-foreground">{concept}</span> — one focused case that can be
                    copied, reviewed, and run as a whole.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">How it works:</span> the snippet keeps the relevant
                    state and helper functions in one small Rust program. The entry point constructs representative input,
                    calls the chapter-specific abstraction, and prints observable output so the behavior can be validated
                    without hidden scaffolding.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Why it is shaped this way:</span> it uses the smallest
                    honest abstraction for the chapter topic and keeps ownership and failure boundaries visible.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">How to validate it:</span> inspect the solution for the
                    owner/borrow boundary, run the example under the chapter&apos;s code key{" "}
                    <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
                      {codeKey ?? "chapter_example"}
                    </code>
                    , then change one input value and confirm the output changes for the reason you expect.
                  </p>
                </div>
              </div>
            </div>
          </details>
        </article>
      </div>
    </div>
  )
}

export const PageCh01WhyRustFeelsDifferentExercises = createExercisePage("ch01-why-rust-feels-different-exercises")
export const PageCh02TheRustMentalModelExercises = createExercisePage("ch02-the-rust-mental-model-exercises")
export const PageCh03ProjectStructureAndToolingExercises = createExercisePage("ch03-project-structure-and-tooling-exercises")
export const PageCh04OwnershipBorrowingAndLifetimesExercises = createExercisePage("ch04-ownership-borrowing-and-lifetimes-exercises")
export const PageCh05OwnershipInsideStructsExercises = createExercisePage("ch05-ownership-inside-structs-exercises")
export const PageCh06OwnershipInsideVectorsExercises = createExercisePage("ch06-ownership-inside-vectors-exercises")
export const PageCh07CopyingDataVsCloningDataExercises = createExercisePage("ch07-copying-data-vs-cloning-data-exercises")
export const PageCh08UndefinedBehaviorAndUnsafeRustExercises = createExercisePage("ch08-undefined-behavior-and-unsafe-rust-exercises")
export const PageCh09SmartPointersAndPinningExercises = createExercisePage("ch09-smart-pointers-and-pinning-exercises")
export const PageCh10ArraysSlicesAndVectorsExercises = createExercisePage("ch10-arrays-slices-and-vectors-exercises")
export const PageCh11HashMapsAndSetsExercises = createExercisePage("ch11-hash-maps-and-sets-exercises")
export const PageCh12MatricesAndMultidimensionalDataExercises = createExercisePage("ch12-matrices-and-multidimensional-data-exercises")
export const PageCh13ArenaAllocationExercises = createExercisePage("ch13-arena-allocation-exercises")
export const PageCh14InterfacesInRustTraitsExercises = createExercisePage("ch14-interfaces-in-rust-traits-exercises")
export const PageCh15OopModelsInRustExercises = createExercisePage("ch15-oop-models-in-rust-exercises")
export const PageCh16DomainDrivenDesignInRustExercises = createExercisePage("ch16-domain-driven-design-in-rust-exercises")
export const PageCh17RefactoringTowardIdiomaticRustExercises = createExercisePage("ch17-refactoring-toward-idiomatic-rust-exercises")
export const PageCh18GenericsInsteadOfTemplatesExercises = createExercisePage("ch18-generics-instead-of-templates-exercises")
export const PageCh19SerializationAndDataContractsExercises = createExercisePage("ch19-serialization-and-data-contracts-exercises")
export const PageCh20MetaprogrammingExercises = createExercisePage("ch20-metaprogramming-exercises")
export const PageCh21ReflectionAndTypeIntrospectionExercises = createExercisePage("ch21-reflection-and-type-introspection-exercises")
export const PageCh22MultithreadingInRustExercises = createExercisePage("ch22-multithreading-in-rust-exercises")
export const PageCh23SynchronizationPrimitivesExercises = createExercisePage("ch23-synchronization-primitives-exercises")
export const PageCh24CoroutinesFuturesAndAsyncRustExercises = createExercisePage("ch24-coroutines-futures-and-async-rust-exercises")
export const PageCh25TokioExercises = createExercisePage("ch25-tokio-exercises")
export const PageCh26TaskLibrariesAndParallelExecutionExercises = createExercisePage("ch26-task-libraries-and-parallel-execution-exercises")
export const PageCh27IoTricksAndSystemsProgrammingPatternsExercises = createExercisePage("ch27-io-tricks-and-systems-programming-patterns-exercises")
export const PageCh28CppIntegrationExercises = createExercisePage("ch28-cpp-integration-exercises")
export const PageCh29JsAndCppIntegrationForWasmExercises = createExercisePage("ch29-js-and-cpp-integration-for-wasm-exercises")
export const PageCh30AmqpAndMessageBrokersExercises = createExercisePage("ch30-amqp-and-message-brokers-exercises")
export const PageCh31DistributedTaskExecutionExercises = createExercisePage("ch31-distributed-task-execution-exercises")
export const PageCh32MpiAndHighPerformanceComputingExercises = createExercisePage("ch32-mpi-and-high-performance-computing-exercises")
export const PageCh33PerformanceOrientedRustExercises = createExercisePage("ch33-performance-oriented-rust-exercises")
export const PageCh34MemoryProfilingExercises = createExercisePage("ch34-memory-profiling-exercises")
export const PageCh35PerformanceProfilingExercises = createExercisePage("ch35-performance-profiling-exercises")
export const PageCh36DistributedTasksProfilingExercises = createExercisePage("ch36-distributed-tasks-profiling-exercises")
export const PageCh37CudaAndGpuAccelerationExercises = createExercisePage("ch37-cuda-and-gpu-acceleration-exercises")
export const PageCh38MerkleTreeGamesAndChallengesExercises = createExercisePage("ch38-merkle-tree-games-and-challenges-exercises")
export const PageCh39GraphSearchGamesExercises = createExercisePage("ch39-graph-search-games-exercises")
export const PageCh40MatrixOptimizationGamesExercises = createExercisePage("ch40-matrix-optimization-games-exercises")
export const PageCh41ErrorHandlingInLargeSystemsExercises = createExercisePage("ch41-error-handling-in-large-systems-exercises")
export const PageCh42TestingAdvancedRustSystemsExercises = createExercisePage("ch42-testing-advanced-rust-systems-exercises")
export const PageCh43ObservabilityExercises = createExercisePage("ch43-observability-exercises")
export const PageCh44PackagingAndDeploymentExercises = createExercisePage("ch44-packaging-and-deployment-exercises")
export const PageCh45CapstoneDistributedRustSystemExercises = createExercisePage("ch45-capstone-distributed-rust-system-exercises")
export const PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegenExercises = createExercisePage("ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises")
export const PageCh47GrpcServicesWithProtobufAndServiceApiCodegenExercises = createExercisePage("ch47-grpc-services-with-protobuf-and-service-api-codegen-exercises")
export const PageCh48WebsocketsLongLivedConnectionsExercises = createExercisePage("ch48-websockets-long-lived-connections-exercises")
export const PageCh49HttpsTlsSecureServiceBoundariesExercises = createExercisePage("ch49-https-tls-secure-service-boundaries-exercises")
export const PageCh50Libp2pPeerToPeerRustSystemsExercises = createExercisePage("ch50-libp2p-peer-to-peer-rust-systems-exercises")
export const PageCh51ZeroKnowledgeProofsRustEngineersExercises = createExercisePage("ch51-zero-knowledge-proofs-rust-engineers-exercises")
export const PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises = createExercisePage("ch52-zokrates-workflows-ethereum-verifiers-exercises")
export const PageCh53EzklVerifiableLlmInferenceGpuZkmlExercises = createExercisePage("ch53-ezkl-verifiable-llm-inference-gpu-zkml-exercises")
export const PageCh54NoStdRustConstrainedRuntimeDerivativesExercises = createExercisePage("ch54-no-std-rust-constrained-runtime-derivatives-exercises")
