import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { IconsProvider } from "./iconsContext";
import "./styles.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

// BASE_URL — каталог публикации: "/" при локальной разработке и "/reminder/" на GitHub Pages
const base = import.meta.env.BASE_URL;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
    /* без service worker уведомления работают, просто без кнопки «Отложить» */
  });
}

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
    },
  ],
  { basename: base },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IconsProvider>
      <RouterProvider router={router} />
    </IconsProvider>
  </StrictMode>,
);
