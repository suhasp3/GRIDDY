import { useState } from "react";
import FlexContainer from "./components/FlexContainer";
import { EditorProvider } from "./EditorContext";
import LayoutTab from "./components/LayoutTab";
import SurveyTab from "./components/SurveyTab";
import PreviewPanel from "./components/PreviewPanel";

function App() {
  const [activeTab, setActiveTab] = useState<"layout" | "survey">("layout");

  return (
    <EditorProvider>
      <FlexContainer
        variant="column-start"
        gap="lg"
        className="min-h-screen w-full bg-slate-50 px-6 py-4"
      >
        <header className="flex w-full items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">
            Grid Question Editor
          </h1>
        </header>

        <main className="grid w-full max-w-6xl grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section aria-label="Layout configuration" className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">
                {activeTab === "layout" ? "Layout" : "Survey"}
              </h2>
              <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("layout")}
                  className={`rounded-md px-2 py-1 font-medium ${
                    activeTab === "layout"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:bg-white/60"
                  }`}
                >
                  Layout
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("survey")}
                  className={`rounded-md px-2 py-1 font-medium ${
                    activeTab === "survey"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:bg-white/60"
                  }`}
                >
                  Survey
                </button>
              </div>
            </div>

            {activeTab === "layout" ? <LayoutTab /> : <SurveyTab />}
          </section>

          <PreviewPanel />
        </main>
      </FlexContainer>
    </EditorProvider>
  );
}

export default App;

