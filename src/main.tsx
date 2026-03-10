import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.tsx";
import Providers from "./components/Providers.tsx";
import "./index.css";
import ErrorPage from "./pages/error-page.tsx";
import HistoryPage from "./pages/HistoryPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <ErrorPage />,
    element: <Providers />,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        path: "history",
        element: <HistoryPage />,
      },
      {
        path: "auth",
        element: <AuthPage />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router}></RouterProvider>
  </React.StrictMode>,
);
