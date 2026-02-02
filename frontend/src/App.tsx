import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Roles } from "./pages/Roles";
import { Users } from "./pages/Users";
import { ProjectList } from "./pages/ProjectList";
import { ProjectPage } from "./pages/ProjectPage";
import { ProjectEditor } from "./pages/ProjectEditor";
import { ProjectForms } from "./pages/ProjectForms";
import { ProjectProcesses } from "./pages/ProjectProcesses";
import { ProjectValidators } from "./pages/ProjectValidators";
import { FormList, FormConstructor } from "./form-constructor";
import { CatalogList, CatalogEditor } from "./catalogs";
import { ProcessEditor } from "./process-editor";
import { DocumentList } from "./runtime/DocumentList";
import { ProjectDocuments } from "./runtime/ProjectDocuments";
import { StartProcess } from "./runtime/StartProcess";
import { RuntimeForm } from "./runtime/RuntimeForm";
import "./App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="roles" element={<Roles />} />
          <Route path="users" element={<Users />} />
          <Route path="catalogs" element={<CatalogList />} />
          <Route path="catalogs/:catalogId" element={<CatalogEditor />} />
          <Route path="forms" element={<FormList />} />
          <Route path="forms/:formId" element={<FormConstructor />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/new" element={<ProjectEditor />} />
          <Route path="projects/:projectId" element={<ProjectPage />}>
            <Route index element={<ProjectEditor />} />
            <Route path="settings" element={<ProjectEditor />} />
            <Route path="forms" element={<ProjectForms />} />
            <Route path="processes" element={<ProjectProcesses />} />
            <Route path="validators" element={<ProjectValidators />} />
          </Route>
          <Route path="projects/:projectId/documents" element={<ProjectDocuments />} />
          <Route path="projects/:projectId/documents/new" element={<StartProcess />} />
          <Route path="processes" element={<Navigate to="/projects" replace />} />
          <Route path="processes/new" element={<ProcessEditor />} />
          <Route path="processes/:processId" element={<ProcessEditor />} />
          <Route path="documents" element={<DocumentList />} />
          <Route path="documents/new" element={<StartProcess />} />
          <Route path="documents/:documentId" element={<RuntimeForm />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
