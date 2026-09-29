import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { IconsProvider } from "./iconsContext";
import "./styles.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* без service worker уведомления работают, просто без кнопки «Отложить» */
  });
}

const router = createBrowserRouter([
  {
    path: "/reminder",
    element: <App />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IconsProvider>
      <RouterProvider router={router} />
    </IconsProvider>
  </StrictMode>,
);
