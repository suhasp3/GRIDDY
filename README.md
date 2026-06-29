# GRIDDY

GRIDDY is a web-based grid question editor for building custom survey grid questions and exporting them into Qualtrics. It lets researchers configure a grid layout, define categories, preview the respondent experience, save reusable survey designs, and generate JavaScript that can be pasted into a Qualtrics question.

Live app: https://griddy-survey.vercel.app/

## Team

Team B: Ishita Siddamreddy, Suhas Puttoju, Katun Li, and Michael Jenkins.

## What GRIDDY Does

- Build and preview custom grid questions.
- Configure survey categories, labels, colors, and interaction behavior.
- Save surveys locally or to a signed-in account.
- Export saved surveys as JSON backups.
- Export a ready-to-import Qualtrics `.qsf` (single grid or a multi-grid bundle) — no manual question/field setup required.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase for authentication and cloud-saved surveys
- Vercel for deployment
- Qualtrics JavaScript export for survey delivery

## Local Setup

Clone the repository:

```bash
git clone https://github.com/suhasp3/GRIDDY.git
cd GRIDDY
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```text
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_public_anon_key
```

Run the app locally:

```bash
npm run dev
```

Open the local URL shown in the terminal, usually `http://localhost:5173`.

## Available Scripts

```bash
npm run dev
```

Starts the local development server.

```bash
npm run build
```

Type-checks the project and builds the production app into `dist/`.

```bash
npm run preview
```

Serves the production build locally for a final check.

```bash
npm run lint
```

Runs ESLint.

```bash
npm run test
```

Runs the Vitest test suite.


## Qualtrics Workflow

The recommended path is a one-click `.qsf` import — GRIDDY builds the entire
survey for you (question, JavaScript, and embedded-data fields), so there is no
manual setup in Qualtrics.

1. Build and preview a grid in GRIDDY (works for standard and experimental modes).
2. Save the survey if you want to reuse or edit it later.
3. Click **Export to Qualtrics**, then **Download .qsf**. (On the *My Surveys*
   page you can select multiple saved surveys and export them all into one
   `.qsf`, one grid per page.)
4. In Qualtrics, go to **Projects → Create project → Survey → "Import a QSF file"**
   and select the downloaded `.qsf`.
5. **Publish.** The grid renders and saves responses automatically into the
   pre-created embedded-data fields (`GridAssignments`, or `GridPrefills` /
   `GridResponses` in experimental mode), visible under **Data & Analysis**.

### Manual fallback

To paste into an existing survey instead, use **Copy code** in the export
dialog: add an Embedded Data element with the listed field(s) to your Survey
Flow, add a Text/Graphic question, and paste the script into its JavaScript
editor.

## Deployment

The production app is deployed on Vercel. Vercel builds the app with:

```bash
npm run build
```

and serves the generated `dist/` folder. The Vercel project must include these environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## Project Structure

- `src/App.tsx`: Main grid editor page.
- `src/components/`: Reusable editor, preview, save, and layout components.
- `src/pages/`: Auth, profile, history, and error pages.
- `src/lib/`: Supabase, auth, saved survey, and Qualtrics export helpers.
- `src/grid-types.ts`: Shared TypeScript types for grid configuration.
- `docs/client-handoff.md`: Client hand-off and deployment plan.
