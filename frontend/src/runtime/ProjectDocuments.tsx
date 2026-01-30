import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  runtime,
  projects,
  catalogs,
  projectFieldsToColumnOptions,
  type DocumentListItem,
  type ProjectResponse,
  type CatalogResponse,
} from "../api/client";
import styles from "./DocumentList.module.css";

const statusLabel: Record<string, string> = {
  active: "В работе",
  completed: "Завершён",
  draft: "Черновик",
  cancelled: "Отменён",
};

function getColumnLabelByKey(project: ProjectResponse | null): Record<string, string> {
  const options = projectFieldsToColumnOptions(project);
  return Object.fromEntries(options.map((o) => [o.key, o.label]));
}

/** Мапа value -> label для справочника (ключ всегда строка для сопоставления с context). */
function catalogValueToLabel(catalog: CatalogResponse | undefined): Record<string, string> {
  if (!catalog?.items?.length) return {};
  return Object.fromEntries(catalog.items.map((i) => [String(i.value), i.label]));
}

function getDocumentCellValue(
  d: DocumentListItem,
  key: string,
  project: ProjectResponse | null,
  catalogsById: Record<string, CatalogResponse>
): string {
  if (key === "document_number") return d.document_number != null ? String(d.document_number) : "";
  if (key === "id") return d.id || "";
  if (key === "process_name") return d.process_name || "Без названия";
  if (key === "status") return statusLabel[d.status] ?? d.status;
  const ctx = d.context ?? {};
  const val = ctx[key];
  const field = project?.fields?.find((f) => f.key === key);
  if (field?.catalog_id && (field.field_type === "select" || field.field_type === "multiselect")) {
    const valueToLabel = catalogValueToLabel(catalogsById[field.catalog_id]);
    if (field.field_type === "multiselect") {
      const arr = Array.isArray(val) ? val : val != null ? [val] : [];
      return arr.map((v) => valueToLabel[String(v)] ?? String(v)).join(", ");
    }
    return val != null ? (valueToLabel[String(val)] ?? String(val)) : "";
  }
  return val != null ? String(val) : "";
}

export function ProjectDocuments() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [list, setList] = useState<DocumentListItem[]>([]);
  const [catalogsById, setCatalogsById] = useState<Record<string, CatalogResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    projects.get(projectId).then(setProject).catch(() => setProject(null));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    runtime
      .listDocuments(projectId)
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!project?.fields?.length) return;
    const catalogIds = [...new Set(project.fields.map((f) => f.catalog_id).filter(Boolean) as string[])];
    if (catalogIds.length === 0) return;
    Promise.all(catalogIds.map((id) => catalogs.get(id)))
      .then((loaded) => {
        const map: Record<string, CatalogResponse> = {};
        loaded.forEach((c) => {
          if (c?.id) map[c.id] = c;
        });
        setCatalogsById(map);
      })
      .catch(() => {});
  }, [project?.id]);

  const columnLabelByKey = getColumnLabelByKey(project);
  const columns = project?.list_columns?.length
    ? project.list_columns.filter((k) => columnLabelByKey[k])
    : ["process_name", "status"];

  const sortedList = useMemo(
    () => [...list].sort((a, b) => (a.document_number ?? 0) - (b.document_number ?? 0)),
    [list]
  );

  if (!projectId) return <div className={styles.wrap}>Не указан проект.</div>;
  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>{project?.name || "Документы проекта"}</h1>
      <p className={styles.intro}>
        Документ — экземпляр процесса: форма движется по шагам процесса.
      </p>
      <Link to={`/projects/${projectId}/documents/new`} className={styles.createLink}>
        Создать документ
      </Link>
      {sortedList.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.docTable}>
            <thead>
              <tr>
                {columns.map((key) => (
                  <th key={key}>{columnLabelByKey[key] ?? key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedList.map((d) => (
                <tr key={d.id}>
                  {columns.map((key) => (
                    <td key={key}>
                      {key === "document_number" || key === "id" || key === "process_name" ? (
                        <Link to={`/documents/${d.id}`} className={styles.docLink}>
                          {getDocumentCellValue(d, key, project, catalogsById)}
                        </Link>
                      ) : (
                        getDocumentCellValue(d, key, project, catalogsById)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.empty}>
          Нет документов. Нажмите «Создать документ», выберите процесс и заполняйте формы по шагам.
        </p>
      )}
    </div>
  );
}
