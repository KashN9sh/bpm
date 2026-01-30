import { Outlet, Link } from "react-router-dom";
import styles from "./Layout.module.css";

export function Layout() {
  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link to="/">Главная</Link>
        <Link to="/roles">Роли</Link>
        <Link to="/catalogs">Справочники</Link>
        <Link to="/forms">Формы</Link>
        <Link to="/processes">Процессы</Link>
        <Link to="/documents">Документы</Link>
        <Link to="/login">Вход</Link>
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
