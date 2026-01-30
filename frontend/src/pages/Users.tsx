import { useEffect, useState } from "react";
import { identity } from "../api/client";
import styles from "./Users.module.css";

export function Users() {
  const [list, setList] = useState<{ id: string; email: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const load = () => {
    setLoading(true);
    Promise.all([identity.listUsers(), identity.listRoles()])
      .then(([users, rolesList]) => {
        setList(users);
        setRoles(rolesList);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;
    setCreating(true);
    setError(null);
    try {
      await identity.createUser(trimmedEmail, password, selectedRoleIds.length ? selectedRoleIds : undefined);
      setEmail("");
      setPassword("");
      setSelectedRoleIds([]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания пользователя");
    } finally {
      setCreating(false);
    }
  };

  if (loading && list.length === 0) return <div className={styles.wrap}>Загрузка…</div>;
  if (error && list.length === 0) return <div className={styles.wrap}>Ошибка: {error}</div>;

  return (
    <div className={styles.wrap}>
      <h1>Пользователи</h1>
      <p className={styles.intro}>
        Создание пользователей и назначение ролей. Роли влияют на доступ к полям форм.
      </p>
      <form onSubmit={create} className={styles.form}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            required
            minLength={1}
          />
        </label>
        {roles.length > 0 && (
          <label>
            Роли
            <div className={styles.roles}>
              {roles.map((r) => (
                <label key={r.id} className={styles.roleCb}>
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </label>
        )}
        <button type="submit" disabled={creating || !email.trim() || !password}>
          {creating ? "Создание…" : "Создать пользователя"}
        </button>
      </form>
      {error && <div className={styles.error}>{error}</div>}
      <ul className={styles.list}>
        {list.map((u) => (
          <li key={u.id}>{u.email}</li>
        ))}
      </ul>
      {list.length === 0 && !loading && (
        <p className={styles.empty}>Нет пользователей. Создайте первого выше.</p>
      )}
    </div>
  );
}
