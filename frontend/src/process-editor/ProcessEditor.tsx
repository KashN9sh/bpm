import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  processes,
  forms,
  projects,
  type ProcessNodeSchema,
  type ProcessEdgeSchema,
  type FormResponse,
  type ProjectResponse,
} from "../api/client";
import { ProcessNode } from "./ProcessNode";
import styles from "./ProcessEditor.module.css";

const nodeTypes: NodeTypes = {
  start: ProcessNode,
  step: ProcessNode,
  gateway: ProcessNode,
  end: ProcessNode,
};

function toFlowNodes(nodes: ProcessNodeSchema[]): Node[] {
  return nodes.map((n) => ({
    id: n.id,
    type: (n.node_type === "start" || n.node_type === "step" || n.node_type === "gateway" || n.node_type === "end")
      ? n.node_type
      : "step",
    data: {
      label: n.label || n.id,
      form_definition_id: n.form_definition_id ?? undefined,
      expression: n.expression ?? undefined,
      nodeType: n.node_type,
      validator_keys: n.validator_keys ?? [],
    },
    position: { x: n.position_x, y: n.position_y },
  }));
}

function fromFlowNodes(nodes: Node[]): ProcessNodeSchema[] {
  return nodes.map((n) => ({
    id: n.id,
    node_type: (n.data as { nodeType?: string })?.nodeType ?? "step",
    label: typeof n.data?.label === "string" ? n.data.label : n.id,
    form_definition_id: (n.data as { form_definition_id?: string })?.form_definition_id ?? null,
    position_x: n.position?.x ?? 0,
    position_y: n.position?.y ?? 0,
    expression: (n.data as { expression?: string })?.expression ?? null,
    validator_keys: (n.data as { validator_keys?: string[] })?.validator_keys ?? [],
  }));
}

function toFlowEdges(edges: ProcessEdgeSchema[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    markerEnd: { type: MarkerType.ArrowClosed },
    data: {
      key: e.key ?? "",
      label: e.label ?? "",
      condition_expression: e.condition_expression ?? undefined,
      transition_validator_keys: e.transition_validator_keys ?? [],
    },
  }));
}

function fromFlowEdges(edges: Edge[]): ProcessEdgeSchema[] {
  return edges.map((e, i) => ({
    id: e.id || `e-${i}`,
    source_node_id: e.source,
    target_node_id: e.target,
    key: (e.data as { key?: string })?.key ?? "",
    label: (e.data as { label?: string })?.label ?? "",
    condition_expression: (e.data as { condition_expression?: string })?.condition_expression ?? null,
    transition_validator_keys: (e.data as { transition_validator_keys?: string[] })?.transition_validator_keys ?? [],
  }));
}

export function ProcessEditor() {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isNew = !processId || processId === "new";
  const projectIdFromUrl = searchParams.get("projectId");
  const projectIdFromState = (location.state as { projectId?: string } | null)?.projectId;
  const projectIdFromContext = projectIdFromUrl || projectIdFromState;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [formList, setFormList] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [validatorPickerOpen, setValidatorPickerOpen] = useState(false);
  const [edgeValidatorPickerOpen, setEdgeValidatorPickerOpen] = useState(false);

  useEffect(() => {
    forms.list().then(setFormList).catch(() => setFormList([]));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    projects.get(projectId).then(setProject).catch(() => setProject(null));
  }, [projectId]);

  useEffect(() => {
    if (isNew) {
      setName("");
      setDescription("");
      setProjectId(projectIdFromContext ?? null);
      setNodes([
        {
          id: "start-1",
          type: "start",
          data: { label: "Старт", nodeType: "start" as const },
          position: { x: 100, y: 100 },
        },
      ]);
      setEdges([]);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      return;
    }
    setLoading(true);
    processes
      .get(processId!)
      .then((p) => {
        setName(p.name);
        setDescription(p.description);
        setProjectId(p.project_id ?? null);
        setNodes(toFlowNodes(p.nodes));
        setEdges(toFlowEdges(p.edges));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [processId, isNew, projectIdFromContext]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim() || "Процесс",
      description: description.trim(),
      project_id: projectId ?? undefined,
      nodes: fromFlowNodes(nodes),
      edges: fromFlowEdges(edges),
    };
    try {
      if (isNew) {
        const created = await processes.create(payload);
        const backUrl = projectIdFromContext
          ? `/processes/${created.id}?projectId=${encodeURIComponent(projectIdFromContext)}`
          : `/processes/${created.id}`;
        navigate(backUrl, {
          replace: true,
          state: projectIdFromContext ? { projectId: projectIdFromContext } : undefined,
        });
      } else {
        await processes.update(processId!, payload);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
  const nodeValidatorKeys = (selectedNode?.data as { validator_keys?: string[] })?.validator_keys ?? [];
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null;
  const edgeTransitionValidatorKeys = (selectedEdge?.data as { transition_validator_keys?: string[] })?.transition_validator_keys ?? [];

  const updateNodeValidatorKeys = useCallback(
    (keys: string[]) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId ? { ...n, data: { ...n.data, validator_keys: keys } } : n
        )
      );
    },
    [selectedNodeId, setNodes]
  );

  const projectVisibilityValidators = (project?.validators ?? []).filter(
    (v) => v.type === "field_visibility"
  );
  const availableToAdd = projectVisibilityValidators.filter(
    (v) => !nodeValidatorKeys.includes(v.key || v.name)
  );

  const addValidatorKey = (key: string) => {
    if (!nodeValidatorKeys.includes(key)) updateNodeValidatorKeys([...nodeValidatorKeys, key]);
    setValidatorPickerOpen(false);
  };

  const removeValidatorKey = (key: string) => {
    updateNodeValidatorKeys(nodeValidatorKeys.filter((k) => k !== key));
  };

  const updateEdgeTransitionValidatorKeys = useCallback(
    (keys: string[]) => {
      if (!selectedEdgeId) return;
      setEdges((eds) =>
        eds.map((e) =>
          e.id === selectedEdgeId ? { ...e, data: { ...e.data, transition_validator_keys: keys } } : e
        )
      );
    },
    [selectedEdgeId, setEdges]
  );

  const projectStepAccessValidators = (project?.validators ?? []).filter(
    (v) => v.type === "step_access"
  );
  const availableEdgeTransitionToAdd = projectStepAccessValidators.filter(
    (v) => !edgeTransitionValidatorKeys.includes(v.key || v.name)
  );

  const addEdgeTransitionValidatorKey = (key: string) => {
    if (!edgeTransitionValidatorKeys.includes(key)) updateEdgeTransitionValidatorKeys([...edgeTransitionValidatorKeys, key]);
    setEdgeValidatorPickerOpen(false);
  };

  const removeEdgeTransitionValidatorKey = (key: string) => {
    updateEdgeTransitionValidatorKeys(edgeTransitionValidatorKeys.filter((k) => k !== key));
  };

  const addNode = (nodeType: "step" | "gateway" | "end") => {
    const id = `${nodeType}-${Date.now()}`;
    const newNode: Node = {
      id,
      type: nodeType,
        data: {
        label: nodeType === "step" ? "Новый шаг" : nodeType === "gateway" ? "Условие" : "Конец",
        nodeType: nodeType,
        validator_keys: [],
      },
      position: { x: 250, y: 200 + nodes.length * 80 },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
  };

  const validatorName = (key: string): string =>
    project?.validators?.find((v) => (v.key || v.name) === key)?.name ?? key;
  const edgeTransitionValidatorName = (key: string): string =>
    project?.validators?.find((v) => (v.key || v.name) === key)?.name ?? key;

  if (loading) return <div className={styles.wrap}>Загрузка…</div>;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.meta}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название процесса"
            className={styles.nameInput}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание"
            className={styles.descInput}
          />
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={() => {
              const pid = projectIdFromContext || projectId;
              navigate(pid ? `/projects/${pid}/processes` : "/projects");
            }}
          >
            К списку
          </button>
        </div>
      </div>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.flowWrap}>
        <ReactFlow
          nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId }))}
          edges={edges.map((e) => {
            const selected = e.id === selectedEdgeId;
            return {
              ...e,
              selected,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                ...(selected ? { color: "#2563eb" } : {}),
              },
            };
          })}
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
            setSelectedEdgeId(null);
          }}
          onEdgeClick={(_, edge) => {
            setSelectedEdgeId(edge.id);
            setSelectedNodeId(null);
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <Panel position="top-left">
            <div className={styles.addNodes}>
              <button type="button" onClick={() => addNode("step")}>
                + Шаг
              </button>
              <button type="button" onClick={() => addNode("gateway")}>
                + Условие
              </button>
              <button type="button" onClick={() => addNode("end")}>
                + Конец
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className={styles.sidebar}>
          <h3>Узел: {selectedNode.id}</h3>
          <label>
            Подпись
            <input
              value={String((selectedNode.data as { label?: string })?.label ?? "")}
              onChange={(e) =>
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === selectedNodeId
                      ? { ...n, data: { ...n.data, label: e.target.value } }
                      : n
                  )
                )
              }
            />
          </label>
          {(selectedNode.data as { nodeType?: string })?.nodeType === "step" && (
            <>
              <label>
                Форма
                <select
                  value={(selectedNode.data as { form_definition_id?: string })?.form_definition_id ?? ""}
                  onChange={(e) =>
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNodeId
                          ? {
                              ...n,
                              data: {
                                ...n.data,
                                form_definition_id: e.target.value || null,
                              },
                            }
                          : n
                      )
                    )
                  }
                >
                  <option value="">— Не выбрана —</option>
                  {formList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.validatorsSection}>
                <h4 className={styles.validatorsTitle}>Валидаторы видимости полей</h4>
                <p className={styles.validatorsHint}>
                  Выберите валидаторы проекта для этого этапа. Они задаются на вкладке «Валидаторы» проекта.
                </p>
                {nodeValidatorKeys.length > 0 && (
                  <ul className={styles.validatorsList}>
                    {nodeValidatorKeys.map((key) => (
                      <li key={key} className={styles.validatorItem}>
                        <span className={styles.validatorKey}>{key}</span>
                        <span className={styles.validatorName}>{validatorName(key)}</span>
                        <button type="button" className={styles.validatorRemoveBtn} onClick={() => removeValidatorKey(key)} title="Убрать">
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className={styles.addValidatorWrap}>
                  <button
                    type="button"
                    className={styles.addValidatorBtn}
                    onClick={() => setValidatorPickerOpen((v) => !v)}
                    disabled={!projectId || availableToAdd.length === 0}
                    title={!projectId ? "Укажите проект процесса" : availableToAdd.length === 0 ? "Все валидаторы уже добавлены" : "Добавить валидатор"}
                  >
                    + Валидатор
                  </button>
                  {validatorPickerOpen && availableToAdd.length > 0 && (
                    <ul className={styles.validatorPickerList}>
                      {availableToAdd.map((v) => (
                        <li key={v.key || v.name}>
                          <button
                            type="button"
                            className={styles.validatorPickerItem}
                            onClick={() => addValidatorKey(v.key || v.name)}
                          >
                            {v.name} <span className={styles.validatorPickerKey}>({v.key || v.name})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {!projectId && (
                  <p className={styles.validatorsEmpty}>Укажите проект процесса выше, чтобы выбирать валидаторы.</p>
                )}
                {projectId && projectVisibilityValidators.length === 0 && (
                  <p className={styles.validatorsEmpty}>В проекте нет валидаторов видимости. Добавьте их на вкладке «Валидаторы» проекта.</p>
                )}
              </div>
            </>
          )}
          {(selectedNode.data as { nodeType?: string })?.nodeType === "gateway" && (
            <label>
              Условие (выражение)
              <input
                placeholder="например: amount > 1000"
                value={(selectedNode.data as { expression?: string })?.expression ?? ""}
                onChange={(e) =>
                  setNodes((nds) =>
                    nds.map((n) =>
                      n.id === selectedNodeId
                        ? { ...n, data: { ...n.data, expression: e.target.value } }
                        : n
                    )
                  )
                }
              />
            </label>
          )}
        </div>
      )}
      {selectedEdge && (
        <div className={styles.sidebar}>
          <h3>Переход: {selectedEdge.source} → {selectedEdge.target}</h3>
          <label>
            Системное имя
            <input
              value={String((selectedEdge.data as { key?: string })?.key ?? "")}
              onChange={(e) =>
                setEdges((eds) =>
                  eds.map((ed) =>
                    ed.id === selectedEdgeId
                      ? { ...ed, data: { ...ed.data, key: e.target.value } }
                      : ed
                  )
                )
              }
              placeholder="step_to_review (латиница, цифры, _)"
            />
          </label>
          <label>
            Название перехода
            <input
              value={String((selectedEdge.data as { label?: string })?.label ?? "")}
              onChange={(e) =>
                setEdges((eds) =>
                  eds.map((ed) =>
                    ed.id === selectedEdgeId
                      ? { ...ed, data: { ...ed.data, label: e.target.value } }
                      : ed
                  )
                )
              }
              placeholder="Например: На согласование"
            />
          </label>
          <div className={styles.validatorsSection}>
            <h4 className={styles.validatorsTitle}>Валидаторы перехода</h4>
            <p className={styles.validatorsHint}>
              Валидаторы доступа к этапу (step_access). Проверяются при переходе по этой стрелке. Задаются на вкладке «Валидаторы» проекта.
            </p>
            {edgeTransitionValidatorKeys.length > 0 && (
              <ul className={styles.validatorsList}>
                {edgeTransitionValidatorKeys.map((key) => (
                  <li key={key} className={styles.validatorItem}>
                    <span className={styles.validatorKey}>{key}</span>
                    <span className={styles.validatorName}>{edgeTransitionValidatorName(key)}</span>
                    <button type="button" className={styles.validatorRemoveBtn} onClick={() => removeEdgeTransitionValidatorKey(key)} title="Убрать">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.addValidatorWrap}>
              <button
                type="button"
                className={styles.addValidatorBtn}
                onClick={() => setEdgeValidatorPickerOpen((v) => !v)}
                disabled={!projectId || availableEdgeTransitionToAdd.length === 0}
                title={!projectId ? "Укажите проект процесса" : availableEdgeTransitionToAdd.length === 0 ? "Все валидаторы уже добавлены" : "Добавить валидатор перехода"}
              >
                + Валидатор
              </button>
              {edgeValidatorPickerOpen && availableEdgeTransitionToAdd.length > 0 && (
                <ul className={styles.validatorPickerList}>
                  {availableEdgeTransitionToAdd.map((v) => (
                    <li key={v.key || v.name}>
                      <button
                        type="button"
                        className={styles.validatorPickerItem}
                        onClick={() => addEdgeTransitionValidatorKey(v.key || v.name)}
                      >
                        {v.name} <span className={styles.validatorPickerKey}>({v.key || v.name})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!projectId && (
              <p className={styles.validatorsEmpty}>Укажите проект процесса выше, чтобы выбирать валидаторы.</p>
            )}
            {projectId && projectStepAccessValidators.length === 0 && (
              <p className={styles.validatorsEmpty}>В проекте нет валидаторов доступа к этапу. Добавьте их на вкладке «Валидаторы» проекта (тип «Доступ к этапу»).</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
