import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { processes, runtime, projects, type ProcessResponse, type ProjectResponse } from "../api/client";
import styles from "./StartProcess.module.css";

export function StartProcess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: projectIdFromParams } = useParams<{ projectId?: string }>();
  const projectIdFromState = (location.state as { projectId?: string } | null)?.projectId ?? null;
  const effectiveProjectId = projectIdFromParams ?? projectIdFromState ?? null;
  const [list, setList] = useState<ProcessResponse[]>([]);
  const [projectList, setProjectList] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(effectiveProjectId);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    projects.list().then(setProjectList).catch(() => setProjectList([]));
  }, []);

  useEffect(() => {
    if (effectiveProjectId) setSelectedProjectId(effectiveProjectId);
  }, [effectiveProjectId]);

  useEffect(() => {
    setLoading(true);
    processes
      .list(selectedProjectId ?? undefined)
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  const start = async (processDefinitionId: string) => {
    setStarting(processDefinitionId);
    setError(null);
    try {
      const { instance_id } = await runtime.startProcess(processDefinitionId);
      navigate(`/documents/${instance_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запуска");
    } finally {
      setStarting(null);
    }
  };

  const isFromProject = Boolean(effectiveProjectId);

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Создать документ</h1>
      <p>Выберите процесс — документ будет двигаться по его шагам (формам).</p>
      {!isFromProject && projectList.length > 0 && (
        <label className={styles.projectFilter}>
          Проект
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
          >
            <option value="">Все проекты</option>
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <ul className={styles.list}>
        {list.map((p) => (
          <li key={p.id}>
            <span className={styles.name}>{p.name}</span>
            {p.description && <span className={styles.desc}> — {p.description}</span>}
            <button
              type="button"
              onClick={() => start(p.id)}
              disabled={starting === p.id}
            >
              {starting === p.id ? "Создаём…" : "Создать"}
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p>Нет процессов. Создайте процесс в редакторе.</p>}
    </div>
  );
}
