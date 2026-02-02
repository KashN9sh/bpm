import { useState } from "react";
import type { FieldAccessRuleSchema } from "../api/client";
import styles from "./AccessConstructor.module.css";

const PERMISSIONS = [
  { value: "read", label: "Только чтение" },
  { value: "write", label: "Редактирование" },
  { value: "hidden", label: "Скрыто" },
] as const;

interface AccessConstructorProps {
  rules: FieldAccessRuleSchema[];
  roles: { id: string; name: string }[];
  onChange: (rules: FieldAccessRuleSchema[]) => void;
}

export function AccessConstructor({
  rules,
  roles,
  onChange,
}: AccessConstructorProps) {
  const [roleId, setRoleId] = useState("");
  const [expression, setExpression] = useState("");
  const [permission, setPermission] = useState<string>("read");

  const addRule = () => {
    if (!roleId.trim() && !expression.trim()) return;
    onChange([
      ...rules,
      {
        role_id: roleId.trim() || undefined,
        expression: expression.trim() || undefined,
        permission,
      },
    ]);
    setRoleId("");
    setExpression("");
    setPermission("read");
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.addRow}>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className={styles.roleSelect}
        >
          <option value="">— Роль —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="Условие (выражение)"
          className={styles.exprInput}
        />
        <select
          value={permission}
          onChange={(e) => setPermission(e.target.value)}
          className={styles.permSelect}
        >
          {PERMISSIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={addRule} className={styles.addBtn}>
          Добавить
        </button>
      </div>
      <ul className={styles.list}>
        {rules.map((r, i) => (
          <li key={i}>
            <span>
              {r.role_id
                ? roles.find((x) => x.id === r.role_id)?.name ?? r.role_id
                : "—"}
            </span>
            <span className={styles.expr}>
              {r.expression || "—"}
            </span>
            <span>{PERMISSIONS.find((p) => p.value === r.permission)?.label ?? r.permission}</span>
            <button
              type="button"
              className={styles.removeBtn}
              aria-label="Удалить правило"
              title="Удалить правило"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeRule(i);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {rules.length === 0 && (
        <p className={styles.hint}>Правила доступа к полю: по роли или по выражению.</p>
      )}
    </div>
  );
}
