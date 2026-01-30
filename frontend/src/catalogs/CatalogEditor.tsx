import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { catalogs, type CatalogItemSchema } from "../api/client";
import styles from "./CatalogEditor.module.css";

export function CatalogEditor() {
  const { catalogId } = useParams<{ catalogId: string }>();
  const navigate = useNavigate();
  const isNew = catalogId === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<CatalogItemSchema[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !catalogId) return;
    setLoading(true);
    catalogs
      .get(catalogId)
      .then((c) => {
        setName(c.name);
        setDescription(c.description);
        setItems(c.items?.length ? c.items : [{ value: "", label: "" }]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [catalogId, isNew]);

  useEffect(() => {
    if (isNew && items.length === 0) {
      setItems([{ value: "", label: "" }]);
    }
  }, [isNew]);

  const updateItem = (index: number, field: "value" | "label", val: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: val } : it))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { value: "", label: "" }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    const trimmed = items.filter((it) => it.value.trim() || it.label.trim());
    const payload = {
      name: name.trim() || "Справочник",
      description: description.trim(),
      items: trimmed.map((it) => ({ value: it.value.trim() || it.label.trim(), label: it.label.trim() || it.value.trim() })),
    };
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await catalogs.create(payload);
        if (created?.id) navigate(`/catalogs/${created.id}`, { replace: true });
      } else if (catalogId) {
        await catalogs.update(catalogId, payload);
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
      <h1>{isNew ? "Новый справочник" : "Редактирование справочника"}</h1>
      {error && <div className={styles.error}>{error}</div>}
      <label>
        Название
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название справочника" />
      </label>
      <label>
        Описание
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" rows={2} />
      </label>
      <div className={styles.section}>
        <h2>Записи (value, label)</h2>
        <button type="button" onClick={addItem} className={styles.addBtn}>
          Добавить запись
        </button>
        <ul className={styles.itemsList}>
          {items.map((it, i) => (
            <li key={i}>
              <input
                value={it.value}
                onChange={(e) => updateItem(i, "value", e.target.value)}
                placeholder="value"
                className={styles.valueInput}
              />
              <input
                value={it.label}
                onChange={(e) => updateItem(i, "label", e.target.value)}
                placeholder="Подпись"
                className={styles.labelInput}
              />
              <button type="button" onClick={() => removeItem(i)} className={styles.removeBtn} aria-label="Удалить">
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={save} disabled={saving}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        <button type="button" onClick={() => navigate("/catalogs")}>
          К списку
        </button>
      </div>
    </div>
  );
}
