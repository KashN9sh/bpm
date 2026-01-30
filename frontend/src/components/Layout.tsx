import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import {
  PanelLeftClose,
  PanelLeft,
  FolderOpen,
  Settings,
  Shield,
  Users,
  BookOpen,
  GitBranch,
  LogOut,
  LogIn,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { projects, type ProjectResponse } from "../api/client";
import styles from "./Layout.module.css";

const ICON_SIZE = 20;

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

export function Layout() {
  const { user, loading, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [projectList, setProjectList] = useState<ProjectResponse[]>([]);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

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
    <div className={styles.root} data-collapsed={collapsed || undefined}>
      <aside className={collapsed ? `${styles.sidebar} ${styles.sidebarCollapsed}` : styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link to="/" className={styles.logo} title={collapsed ? "BPM" : undefined}>
            {collapsed ? "B" : "BPM"}
          </Link>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={toggleSidebar}
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {collapsed ? <PanelLeft size={ICON_SIZE} /> : <PanelLeftClose size={ICON_SIZE} />}
          </button>
        </div>
        <nav className={styles.nav}>
          {projectList.map((p) => {
            const isProjectActive =
              location.pathname === `/projects/${p.id}` ||
              location.pathname.startsWith(`/projects/${p.id}/`);
            return (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className={isProjectActive ? styles.navLinkActive : styles.navLink}
              title={collapsed ? p.name : undefined}
            >
              <span className={styles.navLinkIcon} aria-hidden><FolderOpen size={ICON_SIZE} /></span>
              <span className={styles.navLinkText}>{p.name}</span>
            </Link>
            );
          })}
          {isAdmin && (
            <>
              <Link
                to="/projects"
                className={
                  location.pathname === "/projects" ||
                  location.pathname === "/projects/new"
                    ? styles.navLinkActive
                    : styles.navLink
                }
                title={collapsed ? "Управление проектами" : undefined}
              >
                <span className={styles.navLinkIcon} aria-hidden><Settings size={ICON_SIZE} /></span>
                <span className={styles.navLinkText}>Управление проектами</span>
              </Link>
              <Link to="/roles" className={isActive("/roles") ? styles.navLinkActive : styles.navLink} title={collapsed ? "Роли" : undefined}>
                <span className={styles.navLinkIcon} aria-hidden><Shield size={ICON_SIZE} /></span>
                <span className={styles.navLinkText}>Роли</span>
              </Link>
              <Link to="/users" className={isActive("/users") ? styles.navLinkActive : styles.navLink} title={collapsed ? "Пользователи" : undefined}>
                <span className={styles.navLinkIcon} aria-hidden><Users size={ICON_SIZE} /></span>
                <span className={styles.navLinkText}>Пользователи</span>
              </Link>
              <Link to="/catalogs" className={isActive("/catalogs") ? styles.navLinkActive : styles.navLink} title={collapsed ? "Справочники" : undefined}>
                <span className={styles.navLinkIcon} aria-hidden><BookOpen size={ICON_SIZE} /></span>
                <span className={styles.navLinkText}>Справочники</span>
              </Link>
              <Link to="/processes" className={isActive("/processes") ? styles.navLinkActive : styles.navLink} title={collapsed ? "Процессы" : undefined}>
                <span className={styles.navLinkIcon} aria-hidden><GitBranch size={ICON_SIZE} /></span>
                <span className={styles.navLinkText}>Процессы</span>
              </Link>
            </>
          )}
        </nav>
        <div className={styles.sidebarFooter}>
          {!loading &&
            (user ? (
              <>
                <div className={styles.userEmail} title={collapsed ? user.email : undefined}>{user.email}</div>
                <button type="button" onClick={handleLogout} className={styles.logoutBtn} title={collapsed ? "Выход" : undefined}>
                  <span className={styles.navLinkIcon} aria-hidden><LogOut size={ICON_SIZE} /></span>
                  <span className={styles.navLinkText}>Выход</span>
                </button>
              </>
            ) : (
              <Link to="/login" className={styles.ctaLink} title={collapsed ? "Вход" : undefined}>
                <span className={styles.navLinkIcon} aria-hidden><LogIn size={ICON_SIZE} /></span>
                <span className={styles.navLinkText}>Вход</span>
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
