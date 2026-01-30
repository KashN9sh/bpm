import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { processes, forms, type ProcessResponse, type FormResponse } from "../api/client";
import styles from "./ProjectForms.module.css";

export function ProjectForms() {
  const { projectId } = useParams<{ projectId: string }>();
  const [formList, setFormList] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    processes
      .list(projectId)
      .then((processList: ProcessResponse[]) => {
        const formIds = new Set<string>();
        processList.forEach((proc) => {
          proc.nodes?.forEach((node) => {
            if (node.form_definition_id) formIds.add(node.form_definition_id);
          });
        });
        if (formIds.size === 0) {
          setFormList([]);
          setLoading(false);
          return;
        }
        return Promise.all([...formIds].map((id) => forms.get(id)));
      })
      .then((results) => {
        if (!results) return;
        setFormList(results.filter((f): f is FormResponse => f != null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) return <div className={styles.wrap}>Не указан проект.</div>;
  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Формы, привязанные к шагам процессов этого проекта. Создайте форму и привяжите её к узлу в редакторе процессов.
      </p>
      <Link
        to={`/forms/new${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}
        state={projectId ? { projectId } : undefined}
        className={styles.createLink}
      >
        Создать форму
      </Link>
      {formList.length > 0 ? (
        <ul className={styles.list}>
          {formList.map((f) => (
            <li key={f.id}>
              <Link to={`/forms/${f.id}?projectId=${encodeURIComponent(projectId)}`} state={{ projectId }}>{f.name}</Link>
              {f.description && <span className={styles.desc}> — {f.description}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          Нет форм в процессах проекта. Создайте форму и привяжите её к шагу процесса в разделе «Процессы».
        </p>
      )}
    </div>
  );
}
