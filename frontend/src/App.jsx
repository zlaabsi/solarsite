import { useState, useEffect } from "react";
import LandingPage from "./components/LandingPage";
import OperationsPage from "./components/OperationsPage";
import AppView from "./components/AppView";

function getRoute() {
  const hash = window.location.hash.replace("#", "") || "/";
  if (hash === "/demo") return "app";
  if (hash === "/ops") return "ops";
  return "landing";
}

export default function App() {
  const [view, setView] = useState(getRoute);

  useEffect(() => {
    const onHash = () => setView(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (route) => {
    if (route === "app") window.location.hash = "#/demo";
    else if (route === "ops") window.location.hash = "#/ops";
    else window.location.hash = "#/";
  };

  if (view === "landing") {
    return <LandingPage onLaunch={() => navigate("ops")} />;
  }

  if (view === "ops") {
    return (
      <OperationsPage
        onLaunch={() => navigate("app")}
        onBack={() => navigate("landing")}
      />
    );
  }

  return <AppView onBack={() => navigate("ops")} />;
}
