import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DataProvider } from "./context/DataContext";

import Landing      from "./Pages/Landing";
import Dashboard    from "./Pages/Dashboard";
import Chat         from "./Pages/chat";
import Reports      from "./Pages/Reports";
import SharedReport from "./Pages/SharedReport";

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"               element={<Landing />}      />
          <Route path="/dashboard"      element={<Dashboard />}    />
          <Route path="/chat"           element={<Chat />}         />
          <Route path="/reports"        element={<Reports />}      />
          <Route path="/report/abc123"  element={<SharedReport />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;