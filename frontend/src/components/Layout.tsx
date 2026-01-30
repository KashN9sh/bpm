import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { projects, type ProjectResponse } from "../api/client";
import styles from "./Layout.module.css";

export function Layout() {
  const { user, loading, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [projectList, setProjectList] = useState<ProjectResponse[]>([]);

  useEffect(() => {
    if (!user) return;
    projects.list().then(setProjectList).catch(() => setProjectList([]));
  }, [user]);

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
          {projectList.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}/documents`}
              className={isActive(`/projects/${p.id}/documents`) ? styles.navLinkActive : styles.navLink}
            >
              {p.name}
            </Link>
          ))}
          {isAdmin && (
            <>
              <Link
                to="/projects"
                className={
                  location.pathname === "/projects" ||
                  location.pathname === "/projects/new" ||
                  /^\/projects\/[^/]+$/.test(location.pathname)
                    ? styles.navLinkActive
                    : styles.navLink
                }
              >
                Управление проектами
              </Link>
              <Link to="/roles" className={isActive("/roles") ? styles.navLinkActive : styles.navLink}>Роли</Link>
              <Link to="/users" className={isActive("/users") ? styles.navLinkActive : styles.navLink}>Пользователи</Link>
              <Link to="/catalogs" className={isActive("/catalogs") ? styles.navLinkActive : styles.navLink}>Справочники</Link>
              <Link to="/forms" className={isActive("/forms") ? styles.navLinkActive : styles.navLink}>Формы</Link>
              <Link to="/processes" className={isActive("/processes") ? styles.navLinkActive : styles.navLink}>Процессы</Link>
            </>
          )}
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
