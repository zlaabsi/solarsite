import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import AppView from "./components/AppView";

function getRoute() {
  const hash = window.location.hash.replace("#", "") || "/";
  return hash === "/demo" ? "app" : "landing";
}

export default function App() {
  const [view, setView] = useState(getRoute);

  useEffect(() => {
    const onHash = () => setView(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (route) => {
    window.location.hash = route === "app" ? "#/demo" : "#/";
  };

  if (view === "landing") {
    return <LandingPage onLaunch={() => navigate("app")} />;
  }

  return <AppView onBack={() => navigate("landing")} />;
}
