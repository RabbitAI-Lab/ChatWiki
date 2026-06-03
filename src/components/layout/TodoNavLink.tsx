"use client";

import { useState, useEffect } from "react";
import NavLink from "./NavLink";

export default function TodoNavLink() {
  const [pendingCount, setPendingCount] = useState<number>(0);

  const fetchPendingCount = () => {
    fetch("/api/todos")
      .then((res) => res.json())
      .then((todos: Array<{ completed: number }>) => {
        setPendingCount(todos.filter((t) => t.completed === 0).length);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchPendingCount();
    const handler = () => fetchPendingCount();
    window.addEventListener("todos-changed", handler);
    return () => window.removeEventListener("todos-changed", handler);
  }, []);

  return (
    <NavLink
      href="/todos"
      badgeCount={pendingCount}
      icon={
        <svg
          className="w-4 h-4 text-blue-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      }
    >
      Todo
    </NavLink>
  );
}
