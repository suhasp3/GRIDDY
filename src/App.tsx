import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ConfigPanel from "./components/ConfigPanel";
import PreviewPanel from "./components/PreviewPanel";
import SaveButton from "./components/SaveButton";
import TourGuide from "./components/TourGuide";
import { useAuth } from "./lib/authContext";
import { useEditor } from "./EditorContext";

function App() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { state, dispatch } = useEditor();
  const [tourRunning, setTourRunning] = useState(false);
  const onStartTour = () => setTourRunning(true);

  const expEnabled = state.config.experimental?.enabled ?? false;

  const firstName = (user?.user_metadata?.first_name as string | undefined)?.trim();
  const lastName = (user?.user_metadata?.last_name as string | undefined)?.trim();
  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
    (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen bg-paper font-sans" style={{ fontFamily: "'Hanken Grotesk', sans-serif" }}>
      <TourGuide run={tourRunning} onFinish={() => setTourRunning(false)} />
      <div className="mx-auto flex w-full max-w-[1480px] flex-col" style={{ minHeight: "100vh" }}>

        {/* ── Top bar ── */}
        <header className="flex items-center gap-4 border-b border-hairline-warm bg-paper-card px-6 py-3.5">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-accent font-serif text-base font-bold text-white">
              G
            </div>
            <span className="font-serif text-[19px] font-bold tracking-tight text-ink">
              GRIDDY
            </span>
            {expEnabled && (
              <span className="ml-2 rounded-md bg-accent-tint px-2.5 py-0.5 text-[11px] font-bold tracking-widest text-accent">
                EXPERIMENT
              </span>
            )}
          </div>

          {/* Study name (centre) */}
          <div className="flex flex-1 justify-center">
            <div
              data-tour="study-name"
              className="flex w-full max-w-[480px] items-center gap-2.5 rounded-lg border border-hairline bg-paper-window px-4 py-2.5"
            >
              <span className="text-[11px] font-bold tracking-widest text-ink-faint">
                STUDY
              </span>
              <input
                type="text"
                value={state.config.name}
                onChange={(e) =>
                  dispatch({
                    type: "setConfig",
                    config: { ...state.config, name: e.target.value },
                  })
                }
                placeholder="Untitled survey"
                className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink placeholder-ink-faint outline-none"
              />
            </div>
          </div>

          {/* Nav + actions */}
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => dispatch({ type: "newSurvey" })}
              className="text-[13.5px] font-semibold text-ink-muted hover:text-ink"
            >
              New
            </button>
            <Link
              to="/history"
              className="text-[13.5px] font-semibold text-ink-muted hover:text-ink"
            >
              My surveys
            </Link>
            <button
              type="button"
              onClick={onStartTour}
              className="text-[13.5px] font-semibold text-ink-muted hover:text-ink"
            >
              Take a tour
            </button>
            {user ? (
              <button
                type="button"
                onClick={() => navigate("/profile")}
                title="View profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint text-xs font-bold text-accent"
              >
                {initials}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-[13.5px] font-semibold text-ink-muted hover:text-ink"
              >
                Sign In
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={() => signOut()}
                className="text-xs text-ink-faint hover:text-ink-muted"
              >
                Sign Out
              </button>
            )}
            <SaveButton />
          </div>
        </header>

        {/* ── Body: config + preview ── */}
        <main className="flex min-h-0 flex-1 gap-7 p-6 md:flex-row">
          {/* Config column */}
          <div className="min-w-0 flex-1 overflow-y-auto">
            <ConfigPanel />
          </div>

          {/* Sticky preview */}
          <div data-tour="preview" className="w-[498px] flex-shrink-0">
            <PreviewPanel />
          </div>
        </main>

      </div>
    </div>
  );
}

export default App;
