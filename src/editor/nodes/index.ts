import type { NodeTypes } from "@xyflow/react";
import StartEndNode from "./StartEndNode.tsx";
import ProcessNode from "./ProcessNode.tsx";
import DecisionNode from "./DecisionNode.tsx";

export const nodeTypes: NodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
};
