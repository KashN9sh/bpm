import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Home.module.css";

export function Home() {
  const { user, isAdmin } = useAuth();

  return (
    <div className={styles.wrap}>
      <h1>BPM</h1>
      <p>Конструктор процессов и форм.</p>
      {user ? (
        <ul>
          {isAdmin && (
            <>
              <li><Link to="/roles">Роли</Link> — создание ролей для доступа к полям</li>
              <li><Link to="/users">Пользователи</Link> — создание пользователей и назначение ролей</li>
              <li><Link to="/catalogs">Справочники</Link> — варианты для полей «Выбор» и «Множественный выбор»</li>
              <li><Link to="/forms">Конструктор форм</Link> — состав полей и правила доступа</li>
              <li><Link to="/processes">Редактор процессов</Link> — диаграмма шагов и переходов</li>
            </>
          )}
          <li><Link to="/documents">Документы</Link> — документ движется по процессу (формы по шагам)</li>
        </ul>
      ) : (
        <p><Link to="/login">Войдите</Link>, чтобы работать с документами.</p>
      )}
    </div>
  );
}
