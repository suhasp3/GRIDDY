import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FlexContainer from "./components/FlexContainer";
import LayoutTab from "./components/LayoutTab";
import PreviewPanel from "./components/PreviewPanel";
import SaveButton from "./components/SaveButton";
import SurveyTab from "./components/SurveyTab";
import { useAuth } from "./lib/authContext";
import { useEditor } from "./EditorContext";

function App() {
  const [activeTab, setActiveTab] = useState<"layout" | "survey">("layout");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { state, dispatch } = useEditor();

  return (
    <FlexContainer
      variant="column-start"
      gap="lg"
      className="min-h-screen w-full bg-slate-50 px-6 py-4"
    >
      <header className="flex w-full items-center justify-between gap-4">
        <h1 className="shrink-0 text-xl font-semibold text-slate-900">
          Grid Question Editor
        </h1>
        <input
          type="text"
          value={state.config.name}
          onChange={(e) =>
            dispatch({ type: "setConfig", config: { ...state.config, name: e.target.value } })
          }
          placeholder="Survey title (required to save)"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
        />
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: "newSurvey" })}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            + New
          </button>
          <Link
            to="/history"
            className="text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            My Surveys
          </Link>
          <SaveButton />
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 truncate max-w-[160px]">{user.email}</span>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Sign In
            </button>
          )}
        </div>
      </header>


      <main className="grid w-full grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
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
  );
}

export default App;
