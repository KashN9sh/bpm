import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  forms,
  catalogs,
  projects,
  type FieldSchema,
  type ProjectFieldSchema,
} from "../api/client";
import type { CatalogResponse, ProjectResponse } from "../api/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./FormConstructor.module.css";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Текст",
  number: "Число",
  textarea: "Текст (многострочный)",
  select: "Выбор",
  multiselect: "Множественный выбор",
  date: "Дата",
  checkbox: "Флажок",
};

function fieldTypeLabel(ft: string): string {
  return FIELD_TYPE_LABELS[ft] ?? ft;
}

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
  const [catalogList, setCatalogList] = useState<CatalogResponse[]>([]);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const [draggingBlockIndex, setDraggingBlockIndex] = useState<number | null>(null);
  const [resizingBlockIndex, setResizingBlockIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(true);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(true);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(12);
  const canvasFieldsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    catalogs.list().then(setCatalogList).catch(() => setCatalogList([]));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    projects.get(projectId).then(setProject).catch(() => setProject(null));
  }, [projectId]);

  useEffect(() => {
    if (isNew || !formId || formId === "undefined") {
      if (!isNew && (!formId || formId === "undefined")) {
        navigate("/projects", { replace: true });
      }
      return;
    }
    setLoading(true);
    forms
      .get(formId, projectId || undefined)
      .then((f) => {
        setName(f.name);
        setDescription(f.description);
        setFields(f.fields?.length ? f.fields : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [formId, isNew]);


  const updateField = useCallback((index: number, patch: Partial<FieldSchema>) => {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }, []);

  const addFieldFromProject = useCallback((pf: ProjectFieldSchema) => {
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
      width: 12,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldIndex(fields.length);
  }, [fields]);

  const removeField = useCallback((index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
    setSelectedFieldIndex((prev) => {
      if (prev == null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }, []);

  const moveField = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setFields((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
    setSelectedFieldIndex((prev) => {
      if (prev == null) return null;
      if (prev === fromIndex) return toIndex;
      if (fromIndex < prev && toIndex >= prev) return prev - 1;
      if (fromIndex > prev && toIndex <= prev) return prev + 1;
      return prev;
    });
  }, []);

  const projectFields = project?.fields ?? [];
  const addedFieldKeys = new Set(fields.map((f) => f.name));
  const projectFieldsAvailable = projectFields.filter((pf) => !addedFieldKeys.has(pf.key));

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

  const handlePaletteDragStart = (e: React.DragEvent, pf: ProjectFieldSchema) => {
    e.dataTransfer.setData("application/x-project-field", JSON.stringify(pf));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCanvasDragOver(false);
    const raw = e.dataTransfer.getData("application/x-project-field");
    if (!raw) return;
    try {
      const pf = JSON.parse(raw) as ProjectFieldSchema;
      addFieldFromProject(pf);
    } catch {
      // ignore
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("application/x-project-field")) {
      setCanvasDragOver(true);
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleCanvasDragLeave = () => {
    setCanvasDragOver(false);
  };

  const handleBlockDragStart = (e: React.DragEvent, index: number) => {
    setDraggingBlockIndex(index);
    e.dataTransfer.setData("application/x-form-field-index", String(index));
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ""); // for Firefox
  };

  const handleBlockDragOver = (e: React.DragEvent, index: number) => {
    if (!e.dataTransfer.types.includes("application/x-form-field-index")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleBlockDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleBlockDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const raw = e.dataTransfer.getData("application/x-form-field-index");
    if (raw === "") return;
    const dragIndex = parseInt(raw, 10);
    if (Number.isNaN(dragIndex)) return;
    const toIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
    if (dragIndex === toIndex) return;
    moveField(dragIndex, toIndex);
  };

  const handleBlockDragEnd = () => {
    setDragOverIndex(null);
    setDraggingBlockIndex(null);
  };

  const handleResizeStart = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingBlockIndex(index);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = fields[index]?.width ?? 12;
  };

  useEffect(() => {
    if (resizingBlockIndex == null) return;
    const container = canvasFieldsRef.current;
    const startX = resizeStartX.current;
    const startW = resizeStartWidth.current;
    const onMove = (e: MouseEvent) => {
      if (container == null) return;
      const rect = container.getBoundingClientRect();
      const colWidth = rect.width / 12;
      const deltaX = e.clientX - startX;
      const deltaCols = Math.round(deltaX / colWidth);
      const newWidth = Math.min(12, Math.max(1, startW + deltaCols));
      setFields((prev) =>
        prev.map((f, idx) =>
          idx === resizingBlockIndex ? { ...f, width: newWidth } : f
        )
      );
    };
    const onUp = () => setResizingBlockIndex(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingBlockIndex]);

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;

  const selectedField = selectedFieldIndex != null ? fields[selectedFieldIndex] : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <input
          type="text"
          className={styles.formName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название формы"
        />
        <input
          type="text"
          className={styles.formDesc}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание"
        />
        <div className={styles.topBarActions}>
          <button
            type="button"
            className={previewMode ? `btnSecondary ${styles.backBtn}` : `btnTertiary ${styles.previewBtnActive}`}
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? "Конструктор" : "Предпросмотр"}
          </button>
          <button type="button" className={`btnPrimary ${styles.saveBtn}`} onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          <button type="button" className={`btnSecondary ${styles.backBtn}`} onClick={() => navigate("/projects")}>
            К списку
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {previewMode ? (
        <div className={styles.previewFull}>
          <h1 className={styles.previewTitle}>{name || "Без названия"}</h1>
          {description && <p className={styles.previewDesc}>{description}</p>}
          <div className={styles.previewForm}>
            {fields.map((f, i) => (
              <label key={i} className={styles.previewField} style={{ gridColumn: `span ${f.width ?? 12}` }}>
                <span>{f.label || f.name}</span>
                {f.field_type === "textarea" ? (
                  <textarea readOnly rows={3} placeholder="" />
                ) : f.field_type === "boolean" ? (
                  <input type="checkbox" disabled />
                ) : f.field_type === "number" ? (
                  <input type="number" readOnly placeholder="" />
                ) : f.field_type === "select" || f.field_type === "multiselect" ? (
                  <select disabled>
                    <option value="">— Выберите —</option>
                    {(f.options ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label ?? opt.value}</option>
                    ))}
                  </select>
                ) : (
                  <input type={f.field_type === "date" ? "date" : "text"} readOnly placeholder="" />
                )}
              </label>
            ))}
            <div className={styles.previewActions}>
              <span className={styles.previewActionsPlaceholder}>Далее</span>
            </div>
          </div>
        </div>
      ) : (
      <div
        className={`${styles.main} ${paletteCollapsed ? styles.paletteCollapsed : ""} ${propertiesCollapsed ? styles.propertiesCollapsed : ""}`}
      >
        <aside className={styles.palette}>
          {paletteCollapsed ? (
            <button
              type="button"
              className={styles.paletteCollapseStrip}
              onClick={() => setPaletteCollapsed(false)}
              title="Развернуть палитру полей"
            >
              <ChevronRight size={18} />
              <span className={styles.paletteCollapseLabel}>Поля</span>
            </button>
          ) : (
            <>
              <div className={styles.paletteTitle}>
                <span>Поля из проекта</span>
                <button
                  type="button"
                  className={styles.paletteToggle}
                  onClick={() => setPaletteCollapsed(true)}
                  aria-label="Свернуть"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              <div className={styles.paletteList}>
                {!projectId && (
                  <p className={styles.hintNoProject}>
                    Откройте форму из вкладки «Формы» проекта, чтобы добавлять поля.
                  </p>
                )}
                {project && projectFieldsAvailable.length === 0 && projectFields.length > 0 && (
                  <p className={styles.paletteEmpty}>Все поля уже добавлены</p>
                )}
                {project && projectFields.length === 0 && (
                  <p className={styles.paletteEmpty}>В настройках проекта нет полей</p>
                )}
                {projectFieldsAvailable.map((pf, i) => (
                  <div
                    key={pf.key || i}
                    className={styles.paletteItem}
                    draggable
                    onDragStart={(e) => handlePaletteDragStart(e, pf)}
                    onClick={() => addFieldFromProject(pf)}
                  >
                    <span>{pf.label || pf.key}</span>
                    <span className={styles.paletteItemType}>{fieldTypeLabel(pf.field_type)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        <section className={styles.canvas}>
          <div
            className={styles.canvasScroll}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
          >
            {fields.length === 0 ? (
              <div
                className={`${styles.canvasEmpty} ${canvasDragOver ? styles.dragOver : ""}`}
              >
                {canvasDragOver
                  ? "Отпустите, чтобы добавить поле"
                  : "Перетащите поля сюда или нажмите на поле в палитре"}
              </div>
            ) : (
                <div ref={canvasFieldsRef} className={styles.canvasFields}>
                  {fields.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className={`${styles.canvasBlock} ${
                        selectedFieldIndex === i ? styles.selected : ""
                      } ${dragOverIndex === i ? styles.canvasBlockDropBefore : ""} ${
                        draggingBlockIndex === i ? styles.dragging : ""
                      }`}
                      style={{ gridColumn: `span ${f.width ?? 12}` }}
                      onClick={() => {
                        if (selectedFieldIndex === i) {
                          setSelectedFieldIndex(null);
                          setPropertiesCollapsed(true);
                        } else {
                          setSelectedFieldIndex(i);
                          setPropertiesCollapsed(false);
                        }
                      }}
                      onDragOver={(e) => handleBlockDragOver(e, i)}
                      onDragLeave={handleBlockDragLeave}
                      onDrop={(e) => handleBlockDrop(e, i)}
                    >
                      <div
                        className={styles.dragHandle}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleBlockDragStart(e, i);
                        }}
                        onDragEnd={handleBlockDragEnd}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className={styles.blockPreview}>
                        <span className={styles.blockLabel}>{f.label || f.name || "Поле"}</span>
                        <span className={styles.blockMeta}>
                          {fieldTypeLabel(f.field_type)}
                          {f.required && " · Обязательное"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.blockRemove}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(i);
                        }}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                      <div
                        className={styles.resizeHandle}
                        onMouseDown={(e) => handleResizeStart(e, i)}
                        onClick={(e) => e.stopPropagation()}
                        title="Тяните для изменения ширины"
                        aria-label="Изменить ширину"
                      />
                    </div>
                  ))}
                </div>
            )}
          </div>
        </section>

        <aside className={styles.properties}>
          {propertiesCollapsed ? (
            <button
              type="button"
              className={styles.propertiesCollapseStrip}
              onClick={() => setPropertiesCollapsed(false)}
              title="Развернуть свойства"
            >
              <ChevronLeft size={18} />
              <span className={styles.propertiesCollapseLabel}>Свойства</span>
            </button>
          ) : (
            <>
              <div className={styles.propertiesTitle}>
                <span>Свойства</span>
                <button
                  type="button"
                  className={styles.propertiesToggle}
                  onClick={() => setPropertiesCollapsed(true)}
                  aria-label="Свернуть"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className={styles.propertiesScroll}>
                {!selectedField ? (
                  <p className={styles.propertiesEmpty}>
                    Выберите поле на холсте, чтобы изменить свойства
                  </p>
                ) : (
                  <>
                    <div className={styles.propertiesSection}>
                      <h3>Поле</h3>
                      <p className={styles.fieldReadOnly}>
                        Ключ: <strong>{selectedField.name}</strong> · Тип: {fieldTypeLabel(selectedField.field_type)}
                        {selectedField.catalog_id &&
                          ` · Справочник: ${catalogList.find((c) => c.id === selectedField.catalog_id)?.name ?? selectedField.catalog_id}`}
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
                      <div className={styles.widthControl}>
                        <span className={styles.widthLabel}>Ширина (колонок из 12):</span>
                        <div className={styles.widthButtons}>
                          {([12, 6, 4, 3] as const).map((w) => (
                            <button
                              key={w}
                              type="button"
                              className={`${styles.widthBtn} ${(selectedField.width ?? 12) === w ? styles.widthBtnActive : ""}`}
                              onClick={() => updateField(selectedFieldIndex!, { width: w })}
                              title={w === 12 ? "Вся строка" : w === 6 ? "Половина" : w === 4 ? "Треть" : "Четверть"}
                            >
                              {w === 12 ? "100%" : w === 6 ? "½" : w === 4 ? "⅓" : "¼"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className={styles.propertiesFooter}>
                      <button
                        type="button"
                        className={styles.propertiesOkBtn}
                        onClick={() => setPropertiesCollapsed(true)}
                      >
                        ОК
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}
