import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { processes, type ProcessResponse } from "../api/client";
import styles from "./ProjectForms.module.css";

export function ProjectProcesses() {
  const { projectId } = useParams<{ projectId: string }>();
  const [list, setList] = useState<ProcessResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    processes
      .list(projectId)
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) return <div className={styles.wrap}>Не указан проект.</div>;
  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Процессы этого проекта. Создайте процесс и привяжите формы к шагам.
      </p>
      <Link
        to={`/processes/new${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}
        state={projectId ? { projectId } : undefined}
        className={styles.createLink}
      >
        Создать процесс
      </Link>
      {list.length > 0 ? (
        <ul className={styles.list}>
          {list.map((p) => (
            <li key={p.id}>
              <Link
                to={`/processes/${p.id}?projectId=${encodeURIComponent(projectId)}`}
                state={{ projectId }}
              >
                {p.name}
              </Link>
              {p.description && <span className={styles.desc}> — {p.description}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          Нет процессов в проекте. Создайте процесс и настройте шаги и переходы.
        </p>
      )}
    </div>
  );
}
