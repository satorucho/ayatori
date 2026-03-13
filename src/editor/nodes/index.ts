import type { NodeTypes } from "@xyflow/react";
import StartEndNode from "./StartEndNode.tsx";
import ProcessNode from "./ProcessNode.tsx";
import DecisionNode from "./DecisionNode.tsx";
import DataNode from "./DataNode.tsx";
import ManualNode from "./ManualNode.tsx";
import ReferenceNode from "./ReferenceNode.tsx";

export const nodeTypes: NodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
  data: DataNode,
  manual: ManualNode,
  reference: ReferenceNode,
};
