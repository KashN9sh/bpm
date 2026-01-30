import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { processes, runtime, type ProcessResponse } from "../api/client";
import styles from "./StartProcess.module.css";

export function StartProcess() {
  const navigate = useNavigate();
  const [list, setList] = useState<ProcessResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    processes
      .list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const start = async (processDefinitionId: string) => {
    setStarting(processDefinitionId);
    setError(null);
    try {
      const { instance_id } = await runtime.startProcess(processDefinitionId);
      navigate(`/documents/${instance_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка запуска");
    } finally {
      setStarting(null);
    }
  };

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;
  if (error) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Создать документ</h1>
      <p>Выберите процесс — документ будет двигаться по его шагам (формам).</p>
      <ul className={styles.list}>
        {list.map((p) => (
          <li key={p.id}>
            <span className={styles.name}>{p.name}</span>
            {p.description && <span className={styles.desc}> — {p.description}</span>}
            <button
              type="button"
              onClick={() => start(p.id)}
              disabled={starting === p.id}
            >
              {starting === p.id ? "Создаём…" : "Создать"}
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p>Нет процессов. Создайте процесс в редакторе.</p>}
    </div>
  );
}
