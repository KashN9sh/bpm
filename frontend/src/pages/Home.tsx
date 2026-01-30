import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Home.module.css";

const sections = [
  { to: "/documents", title: "Документы", desc: "Документ движется по процессу, формы по шагам.", primary: true },
  { to: "/roles", title: "Роли", desc: "Создание ролей для доступа к полям.", admin: true },
  { to: "/users", title: "Пользователи", desc: "Пользователи и назначение ролей.", admin: true },
  { to: "/catalogs", title: "Справочники", desc: "Варианты для полей «Выбор» и «Множественный выбор».", admin: true },
  { to: "/processes", title: "Процессы", desc: "Диаграмма шагов и переходов.", admin: true },
];

export function Home() {
  const { user, isAdmin } = useAuth();

  const visibleSections = sections.filter((s) => !s.admin || isAdmin);

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <h1>BPM</h1>
        <p className={styles.subtitle}>
          Конструктор процессов и форм для дизайнеров, редакторов и разработчиков.
        </p>
      </section>

      {user ? (
        <>
          <h2 className={styles.sectionTitle}>Разделы</h2>
          <div className={styles.grid}>
            {visibleSections.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className={`${styles.card} ${s.primary ? styles.cardWithStrip : ""}`}
              >
                <h3 className={styles.cardTitle}>{s.title}</h3>
                <p className={styles.cardDesc}>{s.desc}</p>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.guestHint}>
          <Link to="/login">Войдите</Link>, чтобы работать с документами и разделами.
        </div>
      )}
    </div>
  );
}
