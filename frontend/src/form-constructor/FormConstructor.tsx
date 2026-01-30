import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  forms,
  identity,
  catalogs,
  projects,
  type FieldSchema,
  type FieldAccessRuleSchema,
  type ProjectFieldSchema,
} from "../api/client";
import type { CatalogResponse, ProjectResponse } from "../api/client";
import { AccessConstructor } from "../access-constructor/AccessConstructor";
import styles from "./FormConstructor.module.css";

export function FormConstructor() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isNew = formId === "new";
  const projectIdFromState = (location.state as { projectId?: string } | null)?.projectId;
  const projectIdFromUrl = searchParams.get("projectId");
  const projectId = projectIdFromUrl || projectIdFromState;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldSchema[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [catalogList, setCatalogList] = useState<CatalogResponse[]>([]);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);

  useEffect(() => {
    identity.listRoles().then(setRoles).catch(() => setRoles([]));
    catalogs.list().then(setCatalogList).catch(() => setCatalogList([]));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    projects.get(projectId).then(setProject).catch(() => setProject(null));
  }, [projectId]);

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
        setFields(f.fields?.length ? f.fields : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [formId, isNew]);

  const updateField = (index: number, patch: Partial<FieldSchema>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  const addFieldFromProject = (pf: ProjectFieldSchema) => {
    const existingKeys = new Set(fields.map((f) => f.name));
    if (existingKeys.has(pf.key)) return;
    const newField: FieldSchema = {
      name: pf.key,
      label: pf.label,
      field_type: pf.field_type,
      required: false,
      options: (pf.options as { value: string; label: string }[]) ?? null,
      validations: null,
      access_rules: [],
      catalog_id: pf.catalog_id ?? undefined,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldIndex(fields.length);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setSelectedFieldIndex(null);
  };

  const projectFields = project?.fields ?? [];
  const addedFieldKeys = new Set(fields.map((f) => f.name));
  const projectFieldsAvailable = projectFields.filter((pf) => !addedFieldKeys.has(pf.key));

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
          navigate(`/forms/${created.id}${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`, {
            replace: true,
            state: projectId ? { projectId } : undefined,
          });
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

      {!projectId && (
        <p className={styles.hint}>
          Откройте форму из раздела «Проекты» → проект → вкладка «Формы», чтобы добавлять поля из проекта.
        </p>
      )}

      {project && (
        <div className={styles.section}>
          <h2>Поля из проекта «{project.name}»</h2>
          {projectFields.length === 0 ? (
            <p className={styles.hint}>
              В настройках проекта нет полей. Добавьте поля во вкладке «Настройки» проекта, затем вернитесь сюда.
            </p>
          ) : projectFieldsAvailable.length > 0 ? (
            <>
              <p className={styles.hint}>
                Добавьте нужные поля в форму — ключ совпадёт со списком документов.
              </p>
              <ul className={styles.projectFieldList}>
                {projectFieldsAvailable.map((pf, i) => (
                  <li key={pf.key || i}>
                    <span>{pf.label || pf.key} ({pf.field_type})</span>
                    <button
                      type="button"
                      className={styles.addFromProjectBtn}
                      onClick={() => addFieldFromProject(pf)}
                    >
                      Добавить в форму
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.hint}>
              Все поля проекта уже добавлены в форму.
            </p>
          )}
        </div>
      )}

      <div className={styles.section}>
        <h2>Поля формы</h2>
        <p className={styles.hint}>Удалить поле из формы можно кнопкой ×.</p>
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
          <h2>Поле: {selectedField.label || selectedField.name || "—"}</h2>
          <div className={styles.fieldForm}>
            <p className={styles.fieldReadOnly}>
              Ключ: <strong>{selectedField.name}</strong> · Тип: {selectedField.field_type}
              {selectedField.catalog_id && ` · Справочник: ${catalogList.find((c) => c.id === selectedField.catalog_id)?.name ?? selectedField.catalog_id}`}
            </p>
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
