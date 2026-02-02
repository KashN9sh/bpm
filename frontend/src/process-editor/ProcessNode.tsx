import { memo } from "react";
import { type NodeProps, Handle, Position } from "@xyflow/react";
import styles from "./ProcessNode.module.css";

const typeLabels: Record<string, string> = {
  start: "Старт",
  step: "Шаг",
  gateway: "Условие",
  end: "Конец",
};

export const ProcessNode = memo(function ProcessNode({ data, id, selected }: NodeProps) {
  const nodeType = (data as { nodeType?: string })?.nodeType ?? "step";
  const label = (data?.label as string) || id;
  const typeLabel = typeLabels[nodeType] ?? nodeType;

  return (
    <div className={`${styles.node} ${styles[nodeType]} ${selected ? styles.selected : ""}`}>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.typeLabel}>{typeLabel}</div>
      <div className={styles.label}>{label}</div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
});
