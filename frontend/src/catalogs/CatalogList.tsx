import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { catalogs, type CatalogResponse } from "../api/client";
import styles from "./CatalogList.module.css";

export function CatalogList() {
  const [list, setList] = useState<CatalogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalogs
      .list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Справочники</h1>
      <p className={styles.intro}>
        Справочники используются в полях типа «Выбор» и «Множественный выбор» — варианты подставляются из справочника.
      </p>
      <Link to="/catalogs/new" className={styles.createLink}>
        Создать справочник
      </Link>
      <ul className={styles.list}>
        {list.map((c) => (
          <li key={c.id}>
            <Link to={c.id ? `/catalogs/${c.id}` : "/catalogs"}>{c.name}</Link>
            {c.description && <span className={styles.desc}> — {c.description}</span>}
            <span className={styles.count}>{c.items?.length ?? 0} записей</span>
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className={styles.empty}>Нет справочников. Создайте справочник для полей select/multiselect.</p>
      )}
    </div>
  );
}
