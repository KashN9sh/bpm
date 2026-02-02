import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { runtime, type CurrentFormResponse } from "../api/client";
import { AppSelect } from "../components/Select";
import styles from "./RuntimeForm.module.css";

export function RuntimeForm() {
  const { documentId } = useParams<{ documentId: string }>();
  const instanceId = documentId;
  const navigate = useNavigate();
  const [state, setState] = useState<CurrentFormResponse | "completed" | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceId) return;
    setLoading(true);
    runtime
      .getCurrentForm(instanceId)
      .then((res) => {
        console.log("Form fields:", res.form_definition.fields.map(f => ({ name: f.name, type: f.field_type })));
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceId || !state || state === "completed" || !("node_id" in state)) return;
    setSaving(true);
    setError(null);
    try {
      await runtime.saveStep(instanceId, state.node_id, formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, chosenEdgeKey?: string | null) => {
    e.preventDefault();
    if (!instanceId || !state || state === "completed" || !("node_id" in state)) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await runtime.submitForm(instanceId, state.node_id, formData, chosenEdgeKey);
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
        <div className={`card ${styles.completedCard}`}>
          <h1>Процесс завершён</h1>
          <button type="button" className="btnPrimary" onClick={() => navigate("/documents")}>
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
      <nav className={styles.navbar}>
        <h1 className={styles.navbarTitle}>{form_definition.name || "Без названия"}</h1>
        <div className={styles.navbarActions}>
          <button
            type="button"
            className="btnPrimary"
            disabled={submitting || saving}
            onClick={handleSave}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          {(state.available_transitions ?? []).map((t) => (
            <button
              key={t.edge_id}
              type="button"
              className="btnPrimary"
              disabled={submitting || saving}
              onClick={(e) => handleSubmit(e, t.key)}
            >
              {submitting ? "Отправка…" : t.label || "Далее"}
            </button>
          ))}
        </div>
      </nav>
      <div className={styles.previewFull}>
        {form_definition.description && (
          <p className={styles.previewDesc}>{form_definition.description}</p>
        )}
        <form onSubmit={handleSave} className={styles.previewForm}>
          {form_definition.fields.map((field) => {
            if (field.field_type === "select" || field.field_type === "multiselect") {
              console.log("Field:", field.name, "type:", field.field_type, "options:", field.options);
            }
            return (
            <label
              key={field.name}
              className={styles.previewField}
              style={{ gridColumn: `span ${field.width ?? 12}` }}
            >
              <span>
                {field.label || field.name}
                {field.required && <span style={{ color: "var(--color-error)", marginLeft: "0.25rem" }}>*</span>}
              </span>
              {field.field_type === "textarea" ? (
                <textarea
                  value={(formData[field.name] as string) ?? ""}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  required={field.required}
                  rows={3}
                  readOnly={field.read_only}
                />
              ) : field.field_type === "boolean" ? (
                <input
                  type="checkbox"
                  checked={Boolean(formData[field.name])}
                  onChange={(e) => updateField(field.name, e.target.checked)}
                  disabled={field.read_only}
                />
              ) : field.field_type === "number" ? (
                <input
                  type="number"
                  value={(formData[field.name] as number) ?? ""}
                  onChange={(e) =>
                    updateField(field.name, e.target.value === "" ? undefined : Number(e.target.value))
                  }
                  required={field.required}
                  readOnly={field.read_only}
                />
              ) : field.field_type === "select" || field.field_type === "multiselect" ? (
                (() => {
                  const isMultiSelect = field.field_type === "multiselect";
                  if (field.field_type === "select" || field.field_type === "multiselect") {
                    console.log("Field type:", field.field_type, "isMulti:", isMultiSelect);
                  }
                  return (
                    <AppSelect
                      value={isMultiSelect ? ((formData[field.name] as string[] | undefined) ?? []) : ((formData[field.name] as string | undefined) ?? "")}
                      onChange={(value) => updateField(field.name, value)}
                      options={(field.options ?? []).map((opt) => ({ value: opt.value, label: opt.label ?? opt.value }))}
                      placeholder="— Выберите —"
                      isMulti={isMultiSelect}
                      isDisabled={field.read_only}
                      isRequired={field.required}
                    />
                  );
                })()
              ) : (
                <input
                  type={field.field_type === "date" || field.field_type === "datetime" ? field.field_type : "text"}
                  value={(formData[field.name] as string) ?? ""}
                  onChange={(e) => updateField(field.name, e.target.value)}
                  required={field.required}
                  readOnly={field.read_only}
                />
              )}
            </label>
            );
          })}
        </form>
      </div>
    </div>
  );
}
