import { useEffect, useState, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  projects,
  catalogs,
  projectFieldsToColumnOptions,
  type ProjectFieldSchema,
  type ProjectResponse,
  type CatalogResponse,
} from "../api/client";
import styles from "./ProjectEditor.module.css";

const PROJECT_FIELD_TYPES = ["text", "number", "date", "textarea", "select", "multiselect", "boolean"] as const;

function emptyProjectField(): ProjectFieldSchema {
  return { key: "", label: "", field_type: "text", catalog_id: null, options: null };
}

export function ProjectEditor() {
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();
  const isNew = !projectId || projectId === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [listColumns, setListColumns] = useState<string[]>(["process_name", "status"]);
  const [fields, setFields] = useState<ProjectFieldSchema[]>([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [closingFieldIndex, setClosingFieldIndex] = useState<number | null>(null);
  const [catalogList, setCatalogList] = useState<CatalogResponse[]>([]);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [dragOverColumnIndex, setDragOverColumnIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalogs.list().then(setCatalogList).catch(() => setCatalogList([]));
  }, []);

  useEffect(() => {
    if (isNew || !projectId) return;
    setLoading(true);
    projects
      .get(projectId)
      .then((p: ProjectResponse) => {
        setName(p.name);
        setDescription(p.description);
        setSortOrder(p.sort_order);
        setListColumns(p.list_columns?.length ? p.list_columns : ["process_name", "status"]);
        setFields(p.fields?.length ? p.fields : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, isNew]);

  const listColumnOptions = projectFieldsToColumnOptions({
    list_columns: listColumns,
    fields,
  } as ProjectResponse);

  const columnLabelByKey: Record<string, string> = Object.fromEntries(
    listColumnOptions.map((o) => [o.key, o.label])
  );

  const addListColumn = (key: string) => {
    if (listColumns.includes(key)) return;
    setListColumns((prev) => [...prev, key]);
  };

  const removeListColumn = (key: string) => {
    setListColumns((prev) => prev.filter((k) => k !== key));
  };

  const moveListColumn = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setListColumns((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
    setDraggedColumnIndex(null);
    setDragOverColumnIndex(null);
  };

  const updateProjectField = (index: number, patch: Partial<ProjectFieldSchema>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  };

  const addProjectField = () => {
    setFields((prev) => [...prev, emptyProjectField()]);
    setSelectedFieldIndex(fields.length);
  };

  const removeProjectField = (index: number) => {
    const key = fields[index]?.key;
    setFields((prev) => prev.filter((_, i) => i !== index));
    if (key) setListColumns((prev) => prev.filter((k) => k !== key));
    setSelectedFieldIndex(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim() || "Проект",
      description: description.trim(),
      sort_order: sortOrder,
      list_columns: listColumns.length ? listColumns : ["process_name", "status"],
      fields: fields.filter((f) => f.key.trim()),
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

        <fieldset className={styles.fieldset}>
          <legend>Конструктор полей проекта</legend>
          <p className={styles.fieldsetHint}>
            Добавьте поля — они будут доступны в конструкторе форм и в списке документов.
          </p>
          <button type="button" onClick={addProjectField} className={styles.addBtn}>
            Добавить поле
          </button>
          <ul className={styles.fieldList}>
            {fields.map((f, i) => (
              <Fragment key={i}>
                <li
                  className={selectedFieldIndex === i && closingFieldIndex === null ? styles.selected : ""}
                  onClick={() => {
                    if (selectedFieldIndex === i) {
                      if (closingFieldIndex === null) setClosingFieldIndex(i);
                    } else {
                      setSelectedFieldIndex(i);
                    }
                  }}
                >
                  <span className={styles.fieldName}>
                    {f.key || `Поле ${i + 1}`} ({f.field_type})
                  </span>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProjectField(i);
                    }}
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                </li>
                {(selectedFieldIndex === i || closingFieldIndex === i) && (
                  <li
                    className={`${styles.fieldFormLi} ${closingFieldIndex === i ? styles.fieldFormLiClosing : ""}`}
                    onAnimationEnd={(e) => {
                      if (closingFieldIndex === i && e.animationName?.includes("fieldFormClose")) {
                        setClosingFieldIndex(null);
                        setSelectedFieldIndex(null);
                      }
                    }}
                  >
                    <label>
                      Ключ (key)
                      <input
                        value={fields[i].key}
                        onChange={(e) =>
                          updateProjectField(i, {
                            key: e.target.value.replace(/\s/g, "_"),
                          })
                        }
                        placeholder="field_name"
                      />
                    </label>
                    <label>
                      Подпись
                      <input
                        value={fields[i].label}
                        onChange={(e) =>
                          updateProjectField(i, { label: e.target.value })
                        }
                        placeholder="Подпись"
                      />
                    </label>
                    <label>
                      Тип
                      <select
                        value={fields[i].field_type}
                        onChange={(e) =>
                          updateProjectField(i, {
                            field_type: e.target.value,
                          })
                        }
                      >
                        {PROJECT_FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(fields[i].field_type === "select" ||
                      fields[i].field_type === "multiselect") && (
                      <label>
                        Справочник (варианты выбора)
                        <select
                          value={fields[i].catalog_id ?? ""}
                          onChange={(e) =>
                            updateProjectField(i, {
                              catalog_id: e.target.value || null,
                              options: e.target.value ? null : fields[i].options,
                            })
                          }
                        >
                          <option value="">— Без справочника (options вручную) —</option>
                          {catalogList.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Поля в списке документов</legend>
          <p className={styles.fieldsetHint}>
            Порядок колонок можно менять перетаскиванием. Добавьте колонки из списка ниже.
          </p>
          <ul className={styles.columnOrderList} aria-label="Порядок колонок">
            {listColumns.map((key, i) => (
              <li
                key={key}
                className={`${styles.columnOrderItem} ${draggedColumnIndex === i ? styles.dragging : ""} ${dragOverColumnIndex === i ? styles.dragOver : ""}`}
                draggable
                onDragStart={() => setDraggedColumnIndex(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumnIndex(i);
                }}
                onDragLeave={() => setDragOverColumnIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedColumnIndex != null) moveListColumn(draggedColumnIndex, i);
                }}
                onDragEnd={() => {
                  setDraggedColumnIndex(null);
                  setDragOverColumnIndex(null);
                }}
              >
                <span className={styles.dragHandle} aria-hidden>⋮⋮</span>
                <span className={styles.columnOrderLabel}>{columnLabelByKey[key] ?? key}</span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeListColumn(key)}
                  aria-label={`Удалить колонку ${columnLabelByKey[key] ?? key}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <label className={styles.addColumnLabel}>
            Добавить колонку
            <select
              value=""
              onChange={(e) => {
                const key = e.target.value;
                if (key) addListColumn(key);
                e.target.value = "";
              }}
              className={styles.addColumnSelect}
            >
              <option value="">— Выберите —</option>
              {listColumnOptions
                .filter((opt) => !listColumns.includes(opt.key))
                .map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </label>
        </fieldset>
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
