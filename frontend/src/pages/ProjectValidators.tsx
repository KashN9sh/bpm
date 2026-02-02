import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { projects, type ProjectResponse, type ValidatorSchema } from "../api/client";
import styles from "./ProjectValidators.module.css";

const VALIDATOR_TYPES = [
  { value: "field_visibility", label: "Видимость полей" },
  { value: "step_access", label: "Доступ к этапу" },
] as const;

const DEFAULT_CODE_FIELD_VISIBILITY = `def validate(context):
    # Верните dict: имя поля -> "hidden" | "read" | "write"
    # Пример: скрыть поле "secret" если роль не админ
    result = {}
    # result["secret"] = "hidden"
    return result
`;

const DEFAULT_CODE_STEP_ACCESS = `def validate(context, node_id):
    # Верните True — доступ разрешён, False — запрещён
    # Пример: этап "review" только если поле approved заполнено
    # if node_id == "review":
    #     return context.get("approved") is True
    return True
`;

export function ProjectValidators() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"field_visibility" | "step_access">("field_visibility");
  const [editCode, setEditCode] = useState("");
  const completionDisposable = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    projects
      .get(projectId)
      .then(setProject)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const validators = project?.validators ?? [];

  const startAdd = () => {
    setEditingIndex(-1);
    setEditKey("");
    setEditName("");
    setEditType("field_visibility");
    setEditCode(DEFAULT_CODE_FIELD_VISIBILITY);
  };

  const startEdit = (index: number) => {
    const v = validators[index];
    setEditingIndex(index);
    setEditKey(v.key ?? "");
    setEditName(v.name);
    setEditType(v.type as "field_visibility" | "step_access");
    setEditCode(v.code || "");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const keyFromName = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "") || "validator";

  const saveEdit = async () => {
    if (!projectId || !project || editingIndex === null) return;
    setSaving(true);
    setError(null);
    const key = editKey.trim() || keyFromName(editName);
    const next: ValidatorSchema[] = [...validators];
    const newValidator: ValidatorSchema = {
      key,
      name: editName.trim(),
      type: editType,
      code: editCode,
    };
    if (editingIndex === -1) {
      next.push(newValidator);
    } else {
      next[editingIndex] = newValidator;
    }
    try {
      const updated = await projects.update(projectId, {
        ...project,
        validators: next,
      });
      setProject(updated);
      setEditingIndex(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const removeValidator = async (index: number) => {
    if (!projectId || !project) return;
    const next = validators.filter((_, i) => i !== index);
    setSaving(true);
    setError(null);
    try {
      const updated = await projects.update(projectId, { ...project, validators: next });
      setProject(updated);
      if (editingIndex === index) setEditingIndex(null);
      else if (editingIndex != null && editingIndex > index) setEditingIndex(editingIndex - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      completionDisposable.current?.dispose();
      completionDisposable.current = null;
    };
  }, []);

  const onEditorMount = (_editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => {
    completionDisposable.current?.dispose();
    const fieldKeys = (project?.fields ?? []).map((f) => f.key);
    const suggestions = [
      ...fieldKeys.map((key) => ({
        label: `context["${key}"]`,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: `context["${key}"]`,
        detail: (project?.fields ?? []).find((f) => f.key === key)?.label ?? key,
      })),
      ...fieldKeys.map((key) => ({
        label: `context.get("${key}")`,
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: `context.get("${key}")`,
        detail: (project?.fields ?? []).find((f) => f.key === key)?.label ?? key,
      })),
      { label: "context", kind: monaco.languages.CompletionItemKind.Variable, insertText: "context" },
      { label: "node_id", kind: monaco.languages.CompletionItemKind.Variable, insertText: "node_id" },
      { label: "role_ids", kind: monaco.languages.CompletionItemKind.Variable, insertText: "role_ids" },
    ];
    completionDisposable.current = monaco.languages.registerCompletionItemProvider("python", {
      triggerCharacters: ['"', "'", "["],
      provideCompletionItems: () => ({ suggestions } as import("monaco-editor").languages.CompletionList),
    });
  };

  const onTypeChange = (t: "field_visibility" | "step_access") => {
    setEditType(t);
    if (editCode === DEFAULT_CODE_FIELD_VISIBILITY || editCode === DEFAULT_CODE_STEP_ACCESS) {
      setEditCode(t === "field_visibility" ? DEFAULT_CODE_FIELD_VISIBILITY : DEFAULT_CODE_STEP_ACCESS);
    }
  };

  if (!projectId) return <div className={styles.wrap}>Не указан проект.</div>;
  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (!project) return <div className={styles.wrap}>Проект не найден.</div>;

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Валидаторы на Python: скрытие полей или доступ к этапу. В коде доступны <code>context</code> (поля документа и <code>role_ids</code>), для доступа к этапу — также <code>node_id</code>.
      </p>
      {error && <div className={styles.error}>{error}</div>}
      <button type="button" className={`btnPrimary ${styles.addBtn}`} onClick={startAdd}>
        Добавить валидатор
      </button>
      {validators.length > 0 && (
        <ul className={styles.list}>
          {validators.map((v, i) => (
            <li key={i} className={styles.item}>
              <span className={styles.itemKey}>{v.key ?? v.name}</span>
              <span className={styles.itemName}>{v.name}</span>
              <span className={styles.itemType}>
                {VALIDATOR_TYPES.find((t) => t.value === v.type)?.label ?? v.type}
              </span>
              <button
                type="button"
                className={`btnSecondary ${styles.editBtn}`}
                onClick={() => startEdit(i)}
                aria-label="Редактировать"
              >
                Изменить
              </button>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeValidator(i)}
                aria-label="Удалить"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {editingIndex !== null && (
        <div className={styles.editor}>
          <h3 className={styles.editorTitle}>
            {editingIndex === -1 ? "Новый валидатор" : "Редактирование"}
          </h3>
          <label className={styles.label}>
            Системное имя
            <input
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              placeholder="field_visibility_by_role (латиница, цифры, _)"
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Название
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Например: Скрыть поле по роли"
              className={styles.input}
            />
          </label>
          <label className={styles.label}>
            Тип
            <select
              value={editType}
              onChange={(e) => onTypeChange(e.target.value as "field_visibility" | "step_access")}
              className={styles.select}
            >
              {VALIDATOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.label}>
            <span className={styles.labelText}>Код (Python)</span>
            <div className={styles.monacoWrap}>
              <Editor
                height="320px"
                language="python"
                value={editCode}
                onChange={(v) => setEditCode(v ?? "")}
                onMount={onEditorMount}
                options={{
                  readOnly: false,
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: "on",
                  padding: { top: 8 },
                }}
              />
            </div>
          </div>
          <div className={styles.editorActions}>
            <button type="button" className={`btnPrimary ${styles.saveBtn}`} onClick={saveEdit} disabled={saving || !editName.trim()}>
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
            <button type="button" className={`btnSecondary ${styles.cancelBtn}`} onClick={cancelEdit} disabled={saving}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
