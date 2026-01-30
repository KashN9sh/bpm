import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Roles } from "./pages/Roles";
import { FormList, FormConstructor } from "./form-constructor";
import { CatalogList, CatalogEditor } from "./catalogs";
import { ProcessEditor, ProcessList } from "./process-editor";
import { DocumentList } from "./runtime/DocumentList";
import { StartProcess } from "./runtime/StartProcess";
import { RuntimeForm } from "./runtime/RuntimeForm";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="roles" element={<Roles />} />
          <Route path="catalogs" element={<CatalogList />} />
          <Route path="catalogs/:catalogId" element={<CatalogEditor />} />
          <Route path="forms" element={<FormList />} />
          <Route path="forms/:formId" element={<FormConstructor />} />
          <Route path="processes" element={<ProcessList />} />
          <Route path="processes/new" element={<ProcessEditor />} />
          <Route path="processes/:processId" element={<ProcessEditor />} />
          <Route path="documents" element={<DocumentList />} />
          <Route path="documents/new" element={<StartProcess />} />
          <Route path="documents/:documentId" element={<RuntimeForm />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
