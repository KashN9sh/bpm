import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { projects } from "../api/client";
import styles from "./ProjectEditor.module.css";

export function ProjectEditor() {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const isNew = !projectId || projectId === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !projectId) return;
    setLoading(true);
    projects
      .get(projectId)
      .then((p) => {
        setName(p.name);
        setDescription(p.description);
        setSortOrder(p.sort_order);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, isNew]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim() || "Проект",
      description: description.trim(),
      sort_order: sortOrder,
    };
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await projects.create(payload);
        if (created?.id) {
          navigate(`/projects/${created.id}`, { replace: true });
        } else {
          setError("Сервер не вернул данные проекта. Проверьте консоль.");
        }
      } else if (projectId) {
        await projects.update(projectId, payload);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;

  return (
    <div className={styles.wrap}>
      <h1>{isNew ? "Новый проект" : "Редактирование проекта"}</h1>
      {error && <div className={styles.error}>{error}</div>}
      <form onSubmit={save} className={styles.form}>
        <label>
          Название
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название проекта"
            required
          />
        </label>
        <label>
          Описание
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание"
          />
        </label>
        <label>
          Порядок сортировки
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            min={0}
          />
        </label>
        <div className={styles.actions}>
          <button type="submit" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          <button type="button" onClick={() => navigate("/projects")}>
            К списку
          </button>
        </div>
      </form>
    </div>
  );
}
