import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { runtime, type DocumentListItem } from "../api/client";
import styles from "./DocumentList.module.css";

const statusLabel: Record<string, string> = {
  active: "В работе",
  completed: "Завершён",
  draft: "Черновик",
  cancelled: "Отменён",
};

export function DocumentList() {
  const [list, setList] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runtime
      .listDocuments()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Документы</h1>
      <p className={styles.intro}>
        Документ — это экземпляр процесса: форма (документ) движется по шагам процесса.
      </p>
      <Link to="/documents/new" className={styles.createLink}>
        Создать документ
      </Link>
      <ul className={styles.list}>
        {list.map((d) => (
          <li key={d.id}>
            <Link to={`/documents/${d.id}`} className={styles.docLink}>
              {d.process_name || "Без названия"} — {statusLabel[d.status] ?? d.status}
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className={styles.empty}>
          Нет документов. Нажмите «Создать документ», выберите процесс и заполняйте формы по шагам.
        </p>
      )}
    </div>
  );
}
