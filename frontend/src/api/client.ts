const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const API_TIMEOUT_MS = 15000;

function getToken(): string | null {
  return localStorage.getItem("token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    signal: options.signal ?? controller.signal,
  });
  clearTimeout(timeoutId);
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
  if (!res.ok) {
    const text = await res.text();
    let message = text || `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text) as { detail?: string | unknown[] };
      if (json.detail !== undefined) {
        message = Array.isArray(json.detail)
          ? (json.detail[0] as { msg?: string })?.msg ?? String(json.detail[0])
          : String(json.detail);
      }
    } catch {
      // оставляем message как text
    }
    if (res.status === 403) message = "Нет прав (требуется роль администратора).";
    if (res.status === 401) message = "Требуется вход в систему.";
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const identity = {
  login: (email: string, password: string) =>
    api<{ access_token: string }>("/api/identity/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<{ id: string; email: string; roles: string[] }>("/api/identity/users/me"),
  listUsers: () => api<{ id: string; email: string; roles?: string[] }[]>("/api/identity/users"),
  createUser: (email: string, password: string, role_ids?: string[]) =>
    api<{ id: string; email: string; roles?: string[] }>("/api/identity/users", {
      method: "POST",
      body: JSON.stringify({ email, password, role_ids }),
    }),
  listRoles: () => api<{ id: string; name: string }[]>("/api/identity/roles"),
  createRole: (name: string) =>
    api<{ id: string; name: string }>("/api/identity/roles", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
};

function requireFormId(id: string | undefined): asserts id is string {
  if (id == null || id === "" || id === "undefined") {
    throw new Error("Form ID is required");
  }
}

export const forms = {
  list: () => api<FormResponse[]>("/api/forms"),
  get: (id: string, projectId?: string) => {
    requireFormId(id);
    const url = projectId ? `/api/forms/${id}?project_id=${encodeURIComponent(projectId)}` : `/api/forms/${id}`;
    return api<FormResponse>(url);
  },
  create: (body: FormCreate) =>
    api<FormResponse>("/api/forms", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: FormUpdate) => {
    requireFormId(id);
    return api<FormResponse>(`/api/forms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  delete: (id: string) => {
    requireFormId(id);
    return api<void>(`/api/forms/${id}`, { method: "DELETE" });
  },
};

export interface FieldAccessRuleSchema {
  role_id?: string | null;
  expression?: string | null;
  permission: string;
}

export interface FieldSchema {
  name: string;
  label: string;
  field_type: string;
  required: boolean;
  options?: { value: string; label: string }[] | null;
  catalog_id?: string | null;
  validations?: Record<string, unknown> | null;
  access_rules?: FieldAccessRuleSchema[] | null;
  /** Колонок из 12 (1–12): 12 = вся строка, 6 = половина, 4 = треть, 3 = четверть */
  width?: number | null;
}

export interface FormResponse {
  id: string;
  name: string;
  description: string;
  fields: FieldSchema[];
}

export interface FormCreate {
  name: string;
  description?: string;
  fields?: FieldSchema[];
}

export interface FormUpdate {
  name?: string;
  description?: string;
  fields?: FieldSchema[];
}

// Catalogs (справочники) API
export interface CatalogItemSchema {
  value: string;
  label: string;
}

export interface CatalogResponse {
  id: string;
  name: string;
  description: string;
  items: CatalogItemSchema[];
}

export const catalogs = {
  list: () => api<CatalogResponse[]>("/api/catalogs"),
  get: (id: string) => api<CatalogResponse>(`/api/catalogs/${id}`),
  create: (body: { name: string; description?: string; items?: CatalogItemSchema[] }) =>
    api<CatalogResponse>("/api/catalogs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: { name?: string; description?: string; items?: CatalogItemSchema[] }) =>
    api<CatalogResponse>(`/api/catalogs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    api<void>(`/api/catalogs/${id}`, { method: "DELETE" }),
};

// Projects API (подпроекты документов)
export interface ProjectFieldSchema {
  key: string;
  label: string;
  field_type: string;
  catalog_id?: string | null;
  options?: Record<string, unknown>[] | null;
}

export interface ValidatorSchema {
  key: string; // системное имя (уникальное в рамках проекта)
  name: string;
  type: "field_visibility" | "step_access";
  code: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  list_columns: string[];
  fields: ProjectFieldSchema[];
  validators: ValidatorSchema[];
}

const BASE_LIST_COLUMN_OPTIONS: { key: string; label: string }[] = [
  { key: "document_number", label: "№ документа" },
  { key: "id", label: "ID документа" },
  { key: "process_name", label: "Процесс" },
  { key: "status", label: "Статус" },
];

export const LIST_COLUMN_OPTIONS = BASE_LIST_COLUMN_OPTIONS;

export function projectFieldsToColumnOptions(project: ProjectResponse | null): { key: string; label: string }[] {
  if (!project?.fields?.length) return BASE_LIST_COLUMN_OPTIONS;
  return [...BASE_LIST_COLUMN_OPTIONS, ...project.fields.map((f) => ({ key: f.key, label: f.label }))];
}

export const projects = {
  list: () => api<ProjectResponse[]>("/api/projects"),
  get: (id: string) => api<ProjectResponse>(`/api/projects/${id}`),
  create: (body: {
    name: string;
    description?: string;
    sort_order?: number;
    list_columns?: string[];
    fields?: ProjectFieldSchema[];
    validators?: ValidatorSchema[];
  }) =>
    api<ProjectResponse>("/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: {
    name?: string;
    description?: string;
    sort_order?: number;
    list_columns?: string[];
    fields?: ProjectFieldSchema[];
    validators?: ValidatorSchema[];
  }) =>
    api<ProjectResponse>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    api<void>(`/api/projects/${id}`, { method: "DELETE" }),
};

// Process Design API — на этапе/условии хранятся ключи валидаторов проекта
export interface ProcessNodeSchema {
  id: string;
  node_type: string;
  label: string;
  form_definition_id?: string | null;
  position_x: number;
  position_y: number;
  expression?: string | null;
  validator_keys?: string[]; // ключи валидаторов проекта (field_visibility), для шага
}

export interface ProcessEdgeSchema {
  id: string;
  source_node_id: string;
  target_node_id: string;
  key?: string; // системное имя (для логирования)
  label?: string; // название перехода
  condition_expression?: string | null;
  transition_validator_keys?: string[]; // ключи валидаторов проекта (step_access) при переходе по этому ребру
}

export interface ProcessResponse {
  id: string;
  name: string;
  description: string;
  version: number;
  project_id: string | null;
  nodes: ProcessNodeSchema[];
  edges: ProcessEdgeSchema[];
}

export interface ProcessCreate {
  name: string;
  description?: string;
  project_id?: string | null;
  nodes?: ProcessNodeSchema[];
  edges?: ProcessEdgeSchema[];
}

export interface ProcessUpdate {
  name?: string;
  description?: string;
  project_id?: string | null;
  nodes?: ProcessNodeSchema[];
  edges?: ProcessEdgeSchema[];
}

export const processes = {
  list: (projectId?: string | null) =>
    api<ProcessResponse[]>(
      projectId ? `/api/processes?project_id=${encodeURIComponent(projectId)}` : "/api/processes"
    ),
  get: (id: string) => api<ProcessResponse>(`/api/processes/${id}`),
  create: (body: ProcessCreate) =>
    api<ProcessResponse>("/api/processes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: ProcessUpdate) =>
    api<ProcessResponse>(`/api/processes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    api<void>(`/api/processes/${id}`, { method: "DELETE" }),
};

// Runtime API
export interface AvailableTransition {
  edge_id: string;
  key: string;
  label: string;
  target_node_id: string;
}

export interface CurrentFormResponse {
  instance_id: string;
  node_id: string;
  form_definition: {
    id: string;
    name: string;
    description: string;
    fields: Array<{
      name: string;
      label: string;
      field_type: string;
      required: boolean;
      read_only?: boolean;
      options?: { value: string; label: string }[] | null;
      validations?: Record<string, unknown> | null;
      width?: number | null;
    }>;
  };
  submission_data: Record<string, unknown> | null;
  available_transitions?: AvailableTransition[];
}

export interface DocumentListItem {
  id: string;
  document_number: number;
  process_definition_id: string;
  process_name: string;
  status: string;
  current_node_id: string | null;
  context?: Record<string, unknown>;
}

export const runtime = {
  listDocuments: (projectId?: string | null) =>
    api<DocumentListItem[]>(
      projectId ? `/api/runtime/documents?project_id=${encodeURIComponent(projectId)}` : "/api/runtime/documents"
    ),
  startProcess: (processDefinitionId: string) =>
    api<{ instance_id: string; current_node_id: string; status: string }>(
      `/api/runtime/processes/${processDefinitionId}/start`,
      { method: "POST" }
    ),
  getCurrentForm: (instanceId: string) =>
    api<CurrentFormResponse>(`/api/runtime/instances/${instanceId}/current-form`),
  saveStep: (instanceId: string, nodeId: string, data: Record<string, unknown>) =>
    api<{ saved: boolean }>(`/api/runtime/instances/${instanceId}/nodes/${nodeId}/save`, {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
  submitForm: (
    instanceId: string,
    nodeId: string,
    data: Record<string, unknown>,
    chosenEdgeKey?: string | null
  ) =>
    api<{
      instance_id: string;
      status: string;
      current_node_id: string | null;
      completed: boolean;
    }>(`/api/runtime/instances/${instanceId}/nodes/${nodeId}/submit`, {
      method: "POST",
      body: JSON.stringify({ data, chosen_edge_key: chosenEdgeKey ?? undefined }),
    }),
  getInstance: (instanceId: string) =>
    api<{
      id: string;
      document_number: number;
      process_definition_id: string;
      current_node_id: string | null;
      status: string;
      context: Record<string, unknown>;
    }>(`/api/runtime/instances/${instanceId}`),
};
