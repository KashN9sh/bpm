import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { processes, type ProcessResponse } from "../api/client";
import styles from "./ProcessList.module.css";

export function ProcessList() {
  const [list, setList] = useState<ProcessResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    processes
      .list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Процессы</h1>
      <Link to="/processes/new" className={styles.createLink}>
        Создать процесс
      </Link>
      <ul className={styles.list}>
        {list.map((p) => (
          <li key={p.id}>
            <Link to={`/processes/${p.id}`}>{p.name}</Link>
            {p.description && <span className={styles.desc}> — {p.description}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
