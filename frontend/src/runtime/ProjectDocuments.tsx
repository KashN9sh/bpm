import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { runtime, projects, type DocumentListItem } from "../api/client";
import styles from "./DocumentList.module.css";

const statusLabel: Record<string, string> = {
  active: "В работе",
  completed: "Завершён",
  draft: "Черновик",
  cancelled: "Отменён",
};

export function ProjectDocuments() {
  const { projectId } = useParams<{ projectId: string }>();
  const [projectName, setProjectName] = useState<string>("");
  const [list, setList] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    projects.get(projectId).then((p) => setProjectName(p.name)).catch(() => setProjectName(""));
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

  if (!projectId) return <div className={styles.wrap}>Не указан проект.</div>;
  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>{projectName || "Документы проекта"}</h1>
      <p className={styles.intro}>
        Документ — экземпляр процесса: форма движется по шагам процесса.
      </p>
      <Link to={`/projects/${projectId}/documents/new`} className={styles.createLink}>
        Создать документ
      </Link>
      <ul className={styles.list}>
        {list.map((d) => (
          <li key={d.id}>
            <Link to={`/documents/${d.id}`} className={styles.docLink}>
              {d.process_name || "Без названия"} — {statusLabel[d.status] ?? d.status}
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className={styles.empty}>
          Нет документов. Нажмите «Создать документ», выберите процесс и заполняйте формы по шагам.
        </p>
      )}
    </div>
  );
}
