import { useMemo, useCallback } from "react";
import type { FlowChartSchema, Comment } from "../../types/schema.ts";
import { generateId } from "../../utils/id.ts";

type UpdateFn = (updater: (prev: FlowChartSchema) => FlowChartSchema) => void;

export function useComments(
  schema: FlowChartSchema,
  updateSchema: UpdateFn,
) {
  const addComment = useCallback(
    (targetType: "node" | "edge", targetId: string, text: string) => {
      const comment: Comment = {
        id: generateId("comment"),
        author: "user",
        text,
        resolved: false,
        createdAt: new Date().toISOString(),
      };

      if (targetType === "node") {
        updateSchema((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === targetId
              ? { ...n, comments: [...n.comments, comment] }
              : n,
          ),
        }));
      } else {
        updateSchema((prev) => ({
          ...prev,
          edges: prev.edges.map((e) =>
            e.id === targetId
              ? { ...e, comments: [...e.comments, comment] }
              : e,
          ),
        }));
      }
    },
    [updateSchema],
  );

  const resolveComment = useCallback(
    (targetType: "node" | "edge", targetId: string, commentId: string) => {
      if (targetType === "node") {
        updateSchema((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === targetId
              ? {
                  ...n,
                  comments: n.comments.map((c) =>
                    c.id === commentId ? { ...c, resolved: true } : c,
                  ),
                }
              : n,
          ),
        }));
      } else {
        updateSchema((prev) => ({
          ...prev,
          edges: prev.edges.map((e) =>
            e.id === targetId
              ? {
                  ...e,
                  comments: e.comments.map((c) =>
                    c.id === commentId ? { ...c, resolved: true } : c,
                  ),
                }
              : e,
          ),
        }));
      }
    },
    [updateSchema],
  );

  const unresolvedCount = useMemo(() => {
    let count = 0;
    for (const node of schema.nodes) {
      count += node.comments.filter((c) => !c.resolved).length;
    }
    for (const edge of schema.edges) {
      count += edge.comments.filter((c) => !c.resolved).length;
    }
    return count;
  }, [schema]);

  const unresolvedComments = useMemo(() => {
    const result: Array<{
      targetType: "node" | "edge";
      targetId: string;
      targetLabel: string;
      comment: Comment;
    }> = [];

    for (const node of schema.nodes) {
      for (const comment of node.comments) {
        if (!comment.resolved) {
          result.push({
            targetType: "node",
            targetId: node.id,
            targetLabel: node.label,
            comment,
          });
        }
      }
    }
    for (const edge of schema.edges) {
      for (const comment of edge.comments) {
        if (!comment.resolved) {
          result.push({
            targetType: "edge",
            targetId: edge.id,
            targetLabel: `${edge.source} → ${edge.target}`,
            comment,
          });
        }
      }
    }

    return result;
  }, [schema]);

  return { addComment, resolveComment, unresolvedCount, unresolvedComments };
}
