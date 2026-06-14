"use client"

import { useEffect } from "react"
import { ArrowLeft, BookOpen, CheckCircle2, Code2, Lightbulb, Trophy } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { Button } from "@/components/ui/button"

const FALLBACK_SOLUTION = `fn main() {
    println!("example exercise");
}`

function chapterNumberFromPageId(pageId: string) {
  return pageId.match(/^ch(\d+)/)?.[1] ?? "??"
}

function makeExercisePage(pageId: string) {
  function GeneratedExercisePage() {
    return <SingleExampleExercisePage pageId={pageId} />
  }

  GeneratedExercisePage.displayName = `ExercisePage(${pageId})`
  return GeneratedExercisePage
}

function SingleExampleExercisePage({ pageId }: { pageId: string }) {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById(pageId)
  const mainPageId = pageId.replace(/-exercises$/, "")
  const mainPageIndex = getPageIndexById(mainPageId)
  const page = PAGES[pageIndex]
  const mainPage = PAGES[mainPageIndex]
  const chapterNumber = chapterNumberFromPageId(pageId)
  const codeKey = mainPage.codeKeys?.[0]
  const solutionCode = (codeKey ? DEFAULT_CODES[codeKey] : undefined) ?? FALLBACK_SOLUTION

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
          One focused exercise case for <span className="font-medium text-foreground">{mainPage.title}</span>. The page
          intentionally keeps only the representative example, its acceptance criteria, and an openable complete solution
          with an explanation.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Example exercise case</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Starting from the chapter topic, implement the representative example named{" "}
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
                  {codeKey ?? "chapter_example"}
                </code>
                . Keep the implementation complete, deterministic, and small enough to review in one pass.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter {chapterNumber}
            </Button>
          </div>
        </section>

        <article className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3 mb-4">
            <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Exercise</h3>
              <p className="text-sm text-muted-foreground leading-6 mt-1">{mainPage.description}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-foreground">Acceptance criteria</h4>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>The program is complete and has a runnable entry point.</li>
                <li>The main API shape stays narrow and honest for the chapter concept.</li>
                <li>The implementation uses Rust ownership, borrowing, error, or concurrency tools deliberately.</li>
                <li>The output is deterministic enough for a reader, reviewer, or browser runner to check.</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-foreground">Practice prompt</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Read the example case, implement it without adding extra scaffolding, then compare your result with the
                reference solution below. Focus on the boundary decisions: what owns data, what borrows data, where failure
                is explicit, and where concurrency or unsafe boundaries are kept small.
              </p>
            </div>
          </div>

          <details className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <summary className="cursor-pointer list-none flex items-center gap-2 font-medium text-foreground">
              <Code2 className="h-4 w-4 text-primary" />
              Open complete optimal solution and detailed explainer
            </summary>

            <div className="mt-4 space-y-4">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-5">
                <code>{solutionCode}</code>
              </pre>

              <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm text-muted-foreground leading-6">
                <p>
                  <span className="font-semibold text-foreground">What this solution does:</span> it implements the
                  chapter&apos;s representative example as a complete Rust program rather than a partial sketch. The code
                  can be read from top to bottom and has one clear entry point.
                </p>
                <p>
                  <span className="font-semibold text-foreground">How it works:</span> the solution keeps the core data
                  model and helper functions close to the concept being exercised. It avoids unrelated review questions,
                  extra drills, and broad framework scaffolding. Each important boundary is visible in the type signatures,
                  so a reviewer can see which values are owned, borrowed, copied, synchronized, or converted.
                </p>
                <p>
                  <span className="font-semibold text-foreground">Why this is the optimal exercise answer:</span> it is
                  intentionally minimal but complete. It demonstrates the production habit the chapter is teaching without
                  turning the exercise page into a second chapter. The correctness story is local, the output is
                  deterministic, and the implementation is small enough to paste, run, and review in one sitting.
                </p>
              </div>
            </div>
          </details>
        </article>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">What changed about these exercise pages</h3>
          <p className="text-sm text-muted-foreground leading-6">
            The old multi-drill layout has been replaced by one example exercise case per exercise page. The solution is
            hidden by default in a native details panel, so learners can attempt the exercise first and then open the
            complete reference implementation and explanation when ready.
          </p>
        </section>
      </div>
    </div>
  )
}

export const PageCh01WhyRustFeelsDifferentExercises = makeExercisePage("ch01-why-rust-feels-different-exercises")
export const PageCh02TheRustMentalModelExercises = makeExercisePage("ch02-the-rust-mental-model-exercises")
export const PageCh03ProjectStructureAndToolingExercises = makeExercisePage("ch03-project-structure-and-tooling-exercises")
export const PageCh04OwnershipBorrowingAndLifetimesExercises = makeExercisePage("ch04-ownership-borrowing-and-lifetimes-exercises")
export const PageCh05OwnershipInsideStructsExercises = makeExercisePage("ch05-ownership-inside-structs-exercises")
export const PageCh06OwnershipInsideVectorsExercises = makeExercisePage("ch06-ownership-inside-vectors-exercises")
export const PageCh07CopyingDataVsCloningDataExercises = makeExercisePage("ch07-copying-data-vs-cloning-data-exercises")
export const PageCh08UndefinedBehaviorAndUnsafeRustExercises = makeExercisePage("ch08-undefined-behavior-and-unsafe-rust-exercises")
export const PageCh09SmartPointersAndPinningExercises = makeExercisePage("ch09-smart-pointers-and-pinning-exercises")
export const PageCh10ArraysSlicesAndVectorsExercises = makeExercisePage("ch10-arrays-slices-and-vectors-exercises")
export const PageCh11HashMapsAndSetsExercises = makeExercisePage("ch11-hash-maps-and-sets-exercises")
export const PageCh12MatricesAndMultidimensionalDataExercises = makeExercisePage("ch12-matrices-and-multidimensional-data-exercises")
export const PageCh13ArenaAllocationExercises = makeExercisePage("ch13-arena-allocation-exercises")
export const PageCh14InterfacesInRustTraitsExercises = makeExercisePage("ch14-interfaces-in-rust-traits-exercises")
export const PageCh15OopModelsInRustExercises = makeExercisePage("ch15-oop-models-in-rust-exercises")
export const PageCh16DomainDrivenDesignInRustExercises = makeExercisePage("ch16-domain-driven-design-in-rust-exercises")
export const PageCh17RefactoringTowardIdiomaticRustExercises = makeExercisePage("ch17-refactoring-toward-idiomatic-rust-exercises")
export const PageCh18GenericsInsteadOfTemplatesExercises = makeExercisePage("ch18-generics-instead-of-templates-exercises")
export const PageCh19SerializationAndDataContractsExercises = makeExercisePage("ch19-serialization-and-data-contracts-exercises")
export const PageCh20MetaprogrammingExercises = makeExercisePage("ch20-metaprogramming-exercises")
export const PageCh21ReflectionAndTypeIntrospectionExercises = makeExercisePage("ch21-reflection-and-type-introspection-exercises")
export const PageCh22MultithreadingInRustExercises = makeExercisePage("ch22-multithreading-in-rust-exercises")
export const PageCh23SynchronizationPrimitivesExercises = makeExercisePage("ch23-synchronization-primitives-exercises")
export const PageCh24CoroutinesFuturesAndAsyncRustExercises = makeExercisePage("ch24-coroutines-futures-and-async-rust-exercises")
export const PageCh25TokioExercises = makeExercisePage("ch25-tokio-exercises")
export const PageCh26TaskLibrariesAndParallelExecutionExercises = makeExercisePage("ch26-task-libraries-and-parallel-execution-exercises")
export const PageCh27IoTricksAndSystemsProgrammingPatternsExercises = makeExercisePage("ch27-io-tricks-and-systems-programming-patterns-exercises")
export const PageCh28CppIntegrationExercises = makeExercisePage("ch28-cpp-integration-exercises")
export const PageCh29JsAndCppIntegrationForWasmExercises = makeExercisePage("ch29-js-and-cpp-integration-for-wasm-exercises")
export const PageCh30AmqpAndMessageBrokersExercises = makeExercisePage("ch30-amqp-and-message-brokers-exercises")
export const PageCh31DistributedTaskExecutionExercises = makeExercisePage("ch31-distributed-task-execution-exercises")
export const PageCh32MpiAndHighPerformanceComputingExercises = makeExercisePage("ch32-mpi-and-high-performance-computing-exercises")
export const PageCh33PerformanceOrientedRustExercises = makeExercisePage("ch33-performance-oriented-rust-exercises")
export const PageCh34MemoryProfilingExercises = makeExercisePage("ch34-memory-profiling-exercises")
export const PageCh35PerformanceProfilingExercises = makeExercisePage("ch35-performance-profiling-exercises")
export const PageCh36DistributedTasksProfilingExercises = makeExercisePage("ch36-distributed-tasks-profiling-exercises")
export const PageCh37CudaAndGpuAccelerationExercises = makeExercisePage("ch37-cuda-and-gpu-acceleration-exercises")
export const PageCh38MerkleTreeGamesAndChallengesExercises = makeExercisePage("ch38-merkle-tree-games-and-challenges-exercises")
export const PageCh39GraphSearchGamesExercises = makeExercisePage("ch39-graph-search-games-exercises")
export const PageCh40MatrixOptimizationGamesExercises = makeExercisePage("ch40-matrix-optimization-games-exercises")
export const PageCh41ErrorHandlingInLargeSystemsExercises = makeExercisePage("ch41-error-handling-in-large-systems-exercises")
export const PageCh42TestingAdvancedRustSystemsExercises = makeExercisePage("ch42-testing-advanced-rust-systems-exercises")
export const PageCh43ObservabilityExercises = makeExercisePage("ch43-observability-exercises")
export const PageCh44PackagingAndDeploymentExercises = makeExercisePage("ch44-packaging-and-deployment-exercises")
export const PageCh45CapstoneDistributedRustSystemExercises = makeExercisePage("ch45-capstone-distributed-rust-system-exercises")
export const PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegenExercises = makeExercisePage("ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises")
export const PageCh47GrpcServicesWithProtobufAndServiceApiCodegenExercises = makeExercisePage("ch47-grpc-services-with-protobuf-and-service-api-codegen-exercises")
export const PageCh48WebsocketsLongLivedConnectionsExercises = makeExercisePage("ch48-websockets-long-lived-connections-exercises")
export const PageCh49HttpsTlsSecureServiceBoundariesExercises = makeExercisePage("ch49-https-tls-secure-service-boundaries-exercises")
export const PageCh50Libp2pPeerToPeerRustSystemsExercises = makeExercisePage("ch50-libp2p-peer-to-peer-rust-systems-exercises")
export const PageCh51ZeroKnowledgeProofsRustEngineersExercises = makeExercisePage("ch51-zero-knowledge-proofs-rust-engineers-exercises")
export const PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises = makeExercisePage("ch52-zokrates-workflows-ethereum-verifiers-exercises")
export const PageCh53EzklVerifiableLlmInferenceGpuZkmlExercises = makeExercisePage("ch53-ezkl-verifiable-llm-inference-gpu-zkml-exercises")
export const PageCh54NoStdRustConstrainedRuntimeDerivativesExercises = makeExercisePage("ch54-no-std-rust-constrained-runtime-derivatives-exercises")
