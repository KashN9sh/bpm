import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { runtime, type CurrentFormResponse } from "../api/client";
import styles from "./RuntimeForm.module.css";

export function RuntimeForm() {
  const { documentId } = useParams<{ documentId: string }>();
  const instanceId = documentId;
  const navigate = useNavigate();
  const [state, setState] = useState<CurrentFormResponse | "completed" | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceId) return;
    setLoading(true);
    runtime
      .getCurrentForm(instanceId)
      .then((res) => {
        setState(res);
        setFormData(res.submission_data ?? {});
      })
      .catch((e) => {
        if (e.message?.includes("404") || e.message?.includes("completed")) {
          setState("completed");
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, [instanceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceId || !state || state === "completed" || !("node_id" in state)) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await runtime.submitForm(instanceId, state.node_id, formData);
      if (result.completed) {
        setState("completed");
      } else {
        const next = await runtime.getCurrentForm(instanceId);
        setState(next);
        setFormData(next.submission_data ?? {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;
  if (state === "completed") {
    return (
      <div className={styles.wrap}>
        <div className={styles.completedCard}>
          <h1>Процесс завершён</h1>
          <button type="button" onClick={() => navigate("/documents")}>
            К списку документов
          </button>
        </div>
      </div>
    );
  }
  if (!state) return <div className={styles.wrap}>Нет данных</div>;

  const { form_definition } = state;

  return (
    <div className={styles.wrap}>
      <h1>{form_definition.name}</h1>
      {form_definition.description && (
        <p className={styles.desc}>{form_definition.description}</p>
      )}
      <form onSubmit={handleSubmit} className={styles.form}>
        {form_definition.fields.map((field) => (
          <label key={field.name} className={styles.field}>
            <span>{field.label || field.name}</span>
            {field.field_type === "textarea" ? (
              <textarea
                value={(formData[field.name] as string) ?? ""}
                onChange={(e) => updateField(field.name, e.target.value)}
                required={field.required}
                rows={3}
              />
            ) : field.field_type === "boolean" ? (
              <input
                type="checkbox"
                checked={Boolean(formData[field.name])}
                onChange={(e) => updateField(field.name, e.target.checked)}
              />
            ) : field.field_type === "number" ? (
              <input
                type="number"
                value={(formData[field.name] as number) ?? ""}
                onChange={(e) =>
                  updateField(field.name, e.target.value === "" ? undefined : Number(e.target.value))
                }
                required={field.required}
              />
            ) : field.field_type === "select" ? (
              <select
                value={(formData[field.name] as string) ?? ""}
                onChange={(e) => updateField(field.name, e.target.value)}
                required={field.required}
              >
                <option value="">— Выберите —</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label ?? opt.value}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.field_type === "date" || field.field_type === "datetime" ? field.field_type : "text"}
                value={(formData[field.name] as string) ?? ""}
                onChange={(e) => updateField(field.name, e.target.value)}
                required={field.required}
              />
            )}
          </label>
        ))}
        <div className={styles.actions}>
          <button type="submit" disabled={submitting}>
            {submitting ? "Отправка…" : "Далее"}
          </button>
        </div>
      </form>
    </div>
  );
}
