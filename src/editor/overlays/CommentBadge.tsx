import type { Comment } from "../../types/schema.ts";

interface CommentBadgeProps {
  comments: Comment[];
  onClick?: () => void;
}

export default function CommentBadge({ comments, onClick }: CommentBadgeProps) {
  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  if (unresolvedCount === 0) return null;

  return (
    <button
      onClick={onClick}
      style={{
        position: "absolute",
        top: -8,
        right: -8,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#ff4444",
        color: "#fff",
        fontSize: 9,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        zIndex: 10,
      }}
    >
      {unresolvedCount}
    </button>
  );
}
