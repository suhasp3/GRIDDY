# React + TypeScript + Vite + TailwindCSS + Shadcn UI + React Router v6 Boilerplate

This project is a boilerplate for a React application using TypeScript, Vite, TailwindCSS, Shadcn UI, and React Router v6.

## Getting Started

1. Clone the repository.
2. Install the dependencies using `npm install`.

## Development

To start the development server, run `npm run dev`. This will start Vite, which will serve your application with Hot Module Replacement (HMR).

## Building

To build the project, run `npm run build`. This will first run TypeScript to check for type errors and then Vite to bundle your application.

## Linting

To lint the project, run `npm run lint`. This will run ESLint on all `.ts` and `.tsx` files in the project.

## Project Structure

- `src/`: This is where your application's source code lives.
  - `App.tsx`: The main component of your application.
  - `main.tsx`: The entry point of your application. This is where the React Router is configured and the application is rendered.
  - `pages/`: This directory contains the pages of your application.
  - `components/`: This directory contains the reusable components of your application.
  - `lib/`: This directory contains utility functions and other library code.
- `public/`: This directory contains static assets that will be served by Vite.
- `components.json`: This file contains configuration for Shadcn UI.
- `tsconfig.json`: This file contains configuration for TypeScript.
- `vite.config.ts`: This file contains configuration for Vite.
- `tailwind.config.js`: This file contains configuration for TailwindCSS.

## Routing

Routing is handled by React Router v6. The routes are defined in [`src/main.tsx`](src/main.tsx) using the `createBrowserRouter` function.

## Styling

Styling is done using TailwindCSS. The configuration for TailwindCSS is in [`tailwind.config.js`](tailwind.config.js).

## Shadcn UI

Shadcn UI is configured in [`components.json`](components.json). This file contains configuration for the UI library, including the style, whether to use `.tsx` files, and configuration for TailwindCSS.
