import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  forms,
  identity,
  type FieldSchema,
  type FieldAccessRuleSchema,
} from "../api/client";
import { AccessConstructor } from "../access-constructor/AccessConstructor";
import styles from "./FormConstructor.module.css";

const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
] as const;

const emptyField = (): FieldSchema => ({
  name: "",
  label: "",
  field_type: "text",
  required: false,
  options: null,
  validations: null,
  access_rules: [],
});

export function FormConstructor() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const isNew = formId === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);

  useEffect(() => {
    identity.listRoles().then(setRoles).catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    if (isNew || !formId || formId === "undefined") {
      if (!isNew && (!formId || formId === "undefined")) {
        navigate("/forms", { replace: true });
      }
      return;
    }
    setLoading(true);
    forms
      .get(formId)
      .then((f) => {
        setName(f.name);
        setDescription(f.description);
        setFields(f.fields.length ? f.fields : [emptyField()]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [formId, isNew]);

  const updateField = (index: number, patch: Partial<FieldSchema>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  const addField = () => {
    setFields((prev) => [...prev, emptyField()]);
    setSelectedFieldIndex(fields.length);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setSelectedFieldIndex(null);
  };

  const updateAccessRules = (index: number, rules: FieldAccessRuleSchema[]) => {
    updateField(index, { access_rules: rules });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim() || "Без названия",
      description: description.trim(),
      fields: fields.filter((f) => f.name.trim()),
    };
    try {
      if (isNew) {
        const created = await forms.create(payload);
        if (created?.id) {
          navigate(`/forms/${created.id}`, { replace: true });
        }
      } else if (formId && formId !== "undefined") {
        await forms.update(formId, payload);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;

  const selectedField = selectedFieldIndex != null ? fields[selectedFieldIndex] : null;

  return (
    <div className={styles.wrap}>
      <h1>{isNew ? "Новая форма" : "Редактирование формы"}</h1>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.section}>
        <label>
          Название
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название формы"
          />
        </label>
        <label>
          Описание
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание"
            rows={2}
          />
        </label>
      </div>

      <div className={styles.section}>
        <h2>Поля</h2>
        <button type="button" onClick={addField} className={styles.addBtn}>
          Добавить поле
        </button>
        <ul className={styles.fieldList}>
          {fields.map((f, i) => (
            <li
              key={i}
              className={selectedFieldIndex === i ? styles.selected : ""}
              onClick={() => setSelectedFieldIndex(i)}
            >
              <span className={styles.fieldName}>
                {f.name || `Поле ${i + 1}`} ({f.field_type})
              </span>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  removeField(i);
                }}
                aria-label="Удалить"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selectedField && (
        <div className={styles.section}>
          <h2>Поле: {selectedField.name || "—"}</h2>
          <div className={styles.fieldForm}>
            <label>
              Ключ (name)
              <input
                value={selectedField.name}
                onChange={(e) =>
                  updateField(selectedFieldIndex!, {
                    name: e.target.value.replace(/\s/g, "_"),
                  })
                }
                placeholder="field_name"
              />
            </label>
            <label>
              Подпись
              <input
                value={selectedField.label}
                onChange={(e) =>
                  updateField(selectedFieldIndex!, { label: e.target.value })
                }
                placeholder="Подпись"
              />
            </label>
            <label>
              Тип
              <select
                value={selectedField.field_type}
                onChange={(e) =>
                  updateField(selectedFieldIndex!, {
                    field_type: e.target.value,
                  })
                }
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={selectedField.required}
                onChange={(e) =>
                  updateField(selectedFieldIndex!, { required: e.target.checked })
                }
              />
              Обязательное
            </label>
          </div>
          <h3>Правила доступа к полю</h3>
          <AccessConstructor
            rules={selectedField.access_rules || []}
            roles={roles}
            onChange={(rules) => updateAccessRules(selectedFieldIndex!, rules)}
          />
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        <button type="button" onClick={() => navigate("/forms")}>
          К списку
        </button>
      </div>
    </div>
  );
}
