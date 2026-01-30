import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams, useLocation } from "react-router-dom";
import { projects, type ProjectResponse } from "../api/client";
import styles from "./ProjectPage.module.css";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    projects
      .get(projectId)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) return <div className={styles.wrap}>Не указан проект.</div>;
  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (!project) return <div className={styles.wrap}>Проект не найден.</div>;

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{project.name}</h1>
      <nav className={styles.tabs} aria-label="Вкладки проекта">
        <NavLink
          to={`/projects/${projectId}`}
          end
          className={({ isActive }) => {
            const base = `/projects/${projectId}`;
            const isSettings = location.pathname === base || location.pathname === `${base}/settings`;
            return (isActive || isSettings) ? styles.tabActive : styles.tab;
          }}
        >
          Настройки
        </NavLink>
        <NavLink
          to={`/projects/${projectId}/forms`}
          className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}
        >
          Формы
        </NavLink>
        <NavLink
          to={`/projects/${projectId}/processes`}
          className={({ isActive }) => (isActive ? styles.tabActive : styles.tab)}
        >
          Процессы
        </NavLink>
      </nav>
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
