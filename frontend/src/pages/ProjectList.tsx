import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { projects, type ProjectResponse } from "../api/client";
import styles from "./ProjectList.module.css";

export function ProjectList() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projects
      .list()
      .then(setList)
      .catch((e) => setError(e?.name === "AbortError" ? "Превышено время ожидания. Проверьте подключение к серверу." : (e instanceof Error ? e.message : "Ошибка загрузки")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Проекты</h1>
      <p className={styles.intro}>
        Выберите проект, чтобы открыть его документы. Документ — это экземпляр процесса, который движется по шагам (формам).
      </p>
      {isAdmin && (
        <Link to="/projects/new" className={styles.createLink}>
          Создать проект
        </Link>
      )}
      <ul className={styles.list}>
        {list.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}/documents`} className={styles.link}>
              {p.name}
            </Link>
            {p.description && <span className={styles.desc}> — {p.description}</span>}
            {isAdmin && (
              <Link to={`/projects/${p.id}`} className={styles.editLink}>
                Настройки
              </Link>
            )}
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className={styles.empty}>Нет проектов. Создайте первый проект, затем привяжите к нему процессы в редакторе процессов.</p>
      )}
    </div>
  );
}
