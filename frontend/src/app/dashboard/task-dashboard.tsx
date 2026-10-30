
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5001";

type User = {
  id: string;
  full_name: string;
  email: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  completed_at: string | null;
};

const statusLabels = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

export default function TaskDashboard({
  userName,
}: {
  userName: string;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const apiRequest = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...options.headers,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "The request failed.");
      }

      return result;
    },
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [taskData, userData] = await Promise.all([
        apiRequest("/api/tasks"),
        apiRequest("/api/users"),
      ]);

      setTasks(taskData);
      setUsers(userData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load tasks."
      );
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await apiRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          assigned_to: assignedTo || null,
        }),
      });

      setTitle("");
      setDescription("");
      setAssignedTo("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create task."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(taskId: string, status: Task["status"]) {
    setError("");

    try {
      await apiRequest(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update task."
      );
    }
  }

  function userLabel(userId: string | null) {
    if (!userId) return "Unassigned";

    const user = users.find((item) => item.id === userId);
    return user ? user.full_name || user.email : "Unknown user";
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="text-sm font-medium text-indigo-600">
            Task Management
          </p>
          <h1 className="mt-2 text-3xl font-bold">Your dashboard</h1>
          <p className="mt-2 text-slate-600">Welcome, {userName}.</p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Create a task</h2>

          <form onSubmit={createTask} className="mt-5 space-y-4">
            <div>
              <label htmlFor="title" className="mb-1 block text-sm font-medium">
                Title
              </label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={200}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                placeholder="Enter task title"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium"
              >
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                placeholder="Add details (optional)"
              />
            </div>

            <div>
              <label
                htmlFor="assignee"
                className="mb-1 block text-sm font-medium"
              >
                Assign to
              </label>
              <select
                id="assignee"
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create task"}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Tasks</h2>
            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-8 text-slate-500">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              No tasks yet.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{task.title}</h3>

                      {task.description && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                          {task.description}
                        </p>
                      )}

                      <p className="mt-3 text-sm text-slate-500">
                        Assigned to: {userLabel(task.assigned_to)}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Created {new Date(task.created_at).toLocaleString()}
                      </p>
                    </div>

                    <label className="shrink-0">
                      <span className="mb-1 block text-xs font-medium text-slate-500">
                        Status
                      </span>
                      <select
                        value={task.status}
                        onChange={(event) =>
                          void updateStatus(
                            task.id,
                            event.target.value as Task["status"]
                          )
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
