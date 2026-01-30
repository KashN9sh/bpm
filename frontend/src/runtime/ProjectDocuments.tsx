import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  runtime,
  projects,
  projectFieldsToColumnOptions,
  type DocumentListItem,
  type ProjectResponse,
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

function getDocumentCellValue(d: DocumentListItem, key: string): string {
  if (key === "document_number") return d.document_number != null ? String(d.document_number) : "";
  if (key === "id") return d.id || "";
  if (key === "process_name") return d.process_name || "Без названия";
  if (key === "status") return statusLabel[d.status] ?? d.status;
  const ctx = d.context ?? {};
  const val = ctx[key];
  return val != null ? String(val) : "";
}

export function ProjectDocuments() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [list, setList] = useState<DocumentListItem[]>([]);
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

  const columnLabelByKey = getColumnLabelByKey(project);
  const columns = project?.list_columns?.length
    ? project.list_columns.filter((k) => columnLabelByKey[k])
    : ["process_name", "status"];

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
      {list.length > 0 ? (
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
              {list.map((d) => (
                <tr key={d.id}>
                  {columns.map((key) => (
                    <td key={key}>
                      {key === "document_number" || key === "id" || key === "process_name" ? (
                        <Link to={`/documents/${d.id}`} className={styles.docLink}>
                          {getDocumentCellValue(d, key)}
                        </Link>
                      ) : (
                        getDocumentCellValue(d, key)
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
