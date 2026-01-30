import { useEffect, useState } from "react";
import { identity } from "../api/client";
import styles from "./Roles.module.css";

export function Roles() {
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    identity
      .listRoles()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      await identity.createRole(name);
      setNewName("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания роли");
    } finally {
      setCreating(false);
    }
  };

  if (loading && list.length === 0) return <div className={styles.wrap}>Загрузка…</div>;
  if (error && list.length === 0) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Роли</h1>
      <p className={styles.intro}>
        Роли используются в правилах доступа к полям форм и при назначении пользователям.
      </p>
      <form onSubmit={create} className={styles.form}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Название роли"
          disabled={creating}
        />
        <button type="submit" disabled={creating || !newName.trim()}>
          {creating ? "Создание…" : "Создать роль"}
        </button>
      </form>
      {error && <div className={styles.error}>{error}</div>}
      <ul className={styles.list}>
        {list.map((r) => (
          <li key={r.id}>{r.name}</li>
        ))}
      </ul>
      {list.length === 0 && !loading && (
        <p className={styles.empty}>Нет ролей. Создайте первую роль выше.</p>
      )}
    </div>
  );
}
