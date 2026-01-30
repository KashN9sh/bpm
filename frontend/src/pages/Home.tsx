import { Link } from "react-router-dom";
import styles from "./Home.module.css";

export function Home() {
  return (
    <div className={styles.wrap}>
      <h1>BPM</h1>
      <p>Конструктор процессов и форм.</p>
      <ul>
        <li><Link to="/forms">Конструктор форм</Link> — состав полей и правила доступа</li>
        <li><Link to="/processes">Редактор процессов</Link> — диаграмма шагов и переходов</li>
        <li><Link to="/documents">Документы</Link> — документ движется по процессу (формы по шагам)</li>
      </ul>
    </div>
  );
}
