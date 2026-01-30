import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
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
  type ProcessNodeSchema,
  type ProcessEdgeSchema,
  type FormResponse,
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
    },
    position: { x: n.position_x, y: n.position_y },
  }));
}

function toFlowEdges(edges: ProcessEdgeSchema[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    data: { label: e.label, condition_expression: e.condition_expression },
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
  }));
}

function fromFlowEdges(edges: Edge[]): ProcessEdgeSchema[] {
  return edges.map((e, i) => ({
    id: e.id || `e-${i}`,
    source_node_id: e.source,
    target_node_id: e.target,
    label: (e.data as { label?: string })?.label ?? "",
    condition_expression: (e.data as { condition_expression?: string })?.condition_expression ?? null,
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

  useEffect(() => {
    forms.list().then(setFormList).catch(() => setFormList([]));
  }, []);

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

  const addNode = (nodeType: "step" | "gateway" | "end") => {
    const id = `${nodeType}-${Date.now()}`;
    const newNode: Node = {
      id,
      type: nodeType,
      data: {
        label: nodeType === "step" ? "Новый шаг" : nodeType === "gateway" ? "Условие" : "Конец",
        nodeType: nodeType,
      },
      position: { x: 250, y: 200 + nodes.length * 80 },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
  };

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
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
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
    </div>
  );
}
