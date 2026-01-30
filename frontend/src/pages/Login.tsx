import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { identity } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Login.module.css";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await identity.login(email, password);
      localStorage.setItem("token", access_token);
      const me = await identity.me();
      setUser({ id: me.id, email: me.email, roles: me.roles ?? [] });
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <h1>Вход</h1>
      {error && <div className={styles.error}>{error}</div>}
      <form onSubmit={submit} className={styles.form}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Вход…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
