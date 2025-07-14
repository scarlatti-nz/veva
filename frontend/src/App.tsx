import "./App.scss";
import { AlertProvider } from "./components/Alert";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// Remove DTLPage and FruitionPage imports
// import { DTLPage } from "./pages/DTLPage";
// import { FruitionPage } from "./pages/FruitionPage";
// ConsolePage seems unused now, keeping it commented out in case it's needed later.
// import { ConsolePage } from "./pages/ConsolePage";
// Import ConsolePage
import { ConsolePage } from "./pages/ConsolePage";

function App() {
  return (
    <AlertProvider>
      <BrowserRouter>
        <div data-component="App">
          <Routes>
            <Route path="/" element={<Navigate replace to="/dtl" />} />
            {/* Use ConsolePage with assessment prop */}
            <Route path="/dtl" element={<ConsolePage assessment="dtl" />} />
            <Route
              path="/fruition"
              element={<ConsolePage assessment="fruition" />}
            />
            <Route
              path="/fruition-checklist"
              element={<ConsolePage assessment="fruition-checklist" />}
            />
            {/* Example of keeping old route if needed */}
            {/* <Route path="/console" element={<ConsolePage />} /> */}
            {/* <AuthenticatedTemplate>
              <ConsolePage />
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
              <LoginPage />
            </UnauthenticatedTemplate> */}
          </Routes>
        </div>
      </BrowserRouter>
    </AlertProvider>
  );
}

export default App;
