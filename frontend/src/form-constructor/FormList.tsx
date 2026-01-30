import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { forms, type FormResponse } from "../api/client";
import styles from "./FormList.module.css";

export function FormList() {
  const [list, setList] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    forms
      .list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Формы</h1>
      <Link to="/forms/new" className={styles.createLink}>
        Создать форму
      </Link>
      <ul className={styles.list}>
        {list.map((f) => (
          <li key={f.id}>
            <Link to={f.id ? `/forms/${f.id}` : "/forms"}>{f.name}</Link>
            {f.description && <span className={styles.desc}> — {f.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
