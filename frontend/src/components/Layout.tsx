import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Layout.module.css";

export function Layout() {
  const { user, loading, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link to="/">Главная</Link>
        {isAdmin && (
          <>
            <Link to="/roles">Роли</Link>
            <Link to="/users">Пользователи</Link>
            <Link to="/catalogs">Справочники</Link>
            <Link to="/forms">Формы</Link>
            <Link to="/processes">Процессы</Link>
          </>
        )}
        <Link to="/documents">Документы</Link>
        {!loading &&
          (user ? (
            <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
              Выход ({user.email})
            </button>
          ) : (
            <Link to="/login">Вход</Link>
          ))}
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
