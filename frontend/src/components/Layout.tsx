import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Layout.module.css";

export function Layout() {
  const { user, loading, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <Link to="/" className={styles.logo}>
          BPM
        </Link>
        <nav className={styles.nav}>
          {isAdmin && (
            <>
              <Link to="/roles" className={isActive("/roles") ? styles.navLinkActive : styles.navLink}>Роли</Link>
              <Link to="/users" className={isActive("/users") ? styles.navLinkActive : styles.navLink}>Пользователи</Link>
              <Link to="/catalogs" className={isActive("/catalogs") ? styles.navLinkActive : styles.navLink}>Справочники</Link>
              <Link to="/forms" className={isActive("/forms") ? styles.navLinkActive : styles.navLink}>Формы</Link>
              <Link to="/processes" className={isActive("/processes") ? styles.navLinkActive : styles.navLink}>Процессы</Link>
            </>
          )}
          <Link to="/documents" className={isActive("/documents") ? styles.navLinkActive : styles.navLink}>
            Документы
          </Link>
        </nav>
        <div className={styles.sidebarFooter}>
          {!loading &&
            (user ? (
              <>
                <div className={styles.userEmail}>{user.email}</div>
                <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
                  Выход
                </button>
              </>
            ) : (
              <Link to="/login" className={styles.ctaLink}>
                Вход
              </Link>
            ))}
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
