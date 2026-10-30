"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5001";
type User = { id: string; full_name: string; email: string };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  created_by: string;
  assigned_to: string | null;
  created_at: string;
};
const statuses: Record<Task["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

export default function TaskDashboard({ userName, userId }: { userName: string; userId: string }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  const apiRequest = useCallback(async (path: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...options.headers },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "The request failed. Please try again.");
    return result;
  }, []);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError("");
    }
    try {
      const [taskData, userData] = await Promise.all([apiRequest("/api/tasks"), apiRequest("/api/users")]);
      setTasks(taskData);
      setUsers(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => { void Promise.resolve().then(() => loadData(false)); }, [loadData]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/tasks", { method: "POST", body: JSON.stringify({ title, description: description || null, assigned_to: assignedTo || null }) });
      setTitle(""); setDescription(""); setAssignedTo(""); setFormOpen(false);
      await loadData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally { setSaving(false); }
  }

  async function updateStatus(taskId: string, status: Task["status"]) {
    setError("");
    try {
      const updated = await apiRequest(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setTasks((current) => current.map((task) => task.id === taskId ? updated : task));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update task."); }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) { setError(signOutError.message); setSigningOut(false); return; }
    router.push("/");
    router.refresh();
  }

  function userLabel(userId: string | null) {
    if (!userId) return "Unassigned";
    const user = users.find((item) => item.id === userId);
    return user ? user.full_name || user.email : "Unknown user";
  }

  const counts = tasks.reduce((total, task) => { total[task.status] += 1; return total; }, { pending: 0, in_progress: 0, completed: 0 });
  const summary = [["Total tasks", tasks.length], ["Pending", counts.pending], ["In progress", counts.in_progress], ["Completed", counts.completed]] as const;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="/dashboard"><span className="brand-mark">t</span> taskflow</a>
        <div className="account"><span className="account-name">{userName}</span><button className="signout-button" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button></div>
      </header>
      <div className="dashboard-content">
        <section className="dashboard-heading">
          <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Your tasks</h1><p className="dashboard-subtitle">A clear view of what’s moving and what’s next.</p></div>
          <button className="primary-button" onClick={() => { setError(""); setFormOpen((open) => !open); }} aria-expanded={formOpen}><span aria-hidden="true">＋</span> Create task</button>
        </section>

        {error && <p className="form-error dashboard-error" role="alert">{error}</p>}

        {formOpen && <section className="create-panel" aria-labelledby="create-heading">
          <div className="panel-heading"><div><p className="eyebrow">NEW TASK</p><h2 id="create-heading">Add something to the list</h2></div><button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Close task form">×</button></div>
          <form onSubmit={createTask} className="task-form">
            <div className="field"><label htmlFor="title">Task title <span aria-hidden="true">*</span></label><input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} placeholder="What needs to get done?" autoFocus /></div>
            <div className="field"><label htmlFor="description">Description <span className="optional">Optional</span></label><textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="A little context helps" /></div>
            <div className="form-footer"><div className="field assignee-field"><label htmlFor="assignee">Assign to <span className="optional">Optional</span></label><select id="assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">No assignee</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}</select></div><div className="form-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !title.trim()}>{saving ? "Creating…" : "Create task"}</button></div></div>
          </form>
        </section>}

        <section className="summary-grid" aria-label="Task summary">
          {summary.map(([label, count], index) => <div className="summary-item" key={label}><span className={`summary-dot dot-${index}`} aria-hidden="true"/><span className="summary-label">{label}</span><strong>{loading ? "—" : count}</strong></div>)}
        </section>

        <section className="task-section" aria-labelledby="tasks-heading">
          <div className="section-heading"><div><h2 id="tasks-heading">All tasks</h2><p>Tasks you created or have been assigned</p></div><button className="text-button" onClick={() => void loadData()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
          {loading ? <div className="state-panel" role="status"><span className="spinner"/>Loading your tasks…</div> : tasks.length === 0 ? <div className="empty-panel"><span className="empty-mark" aria-hidden="true">＋</span><h3>A fresh start.</h3><p>Your tasks will show up here. Add one when you’re ready.</p><button className="primary-button" onClick={() => setFormOpen(true)}>Create your first task</button></div> : <div className="task-list">{tasks.map((task) => {
            const canUpdate = task.created_by === userId || task.assigned_to === userId;
            return <article className="task-row" key={task.id}><div className="task-copy"><h3>{task.title}</h3>{task.description && <p className="task-description">{task.description}</p>}<div className="task-meta"><span>To <strong>{userLabel(task.assigned_to)}</strong></span><span aria-hidden="true">·</span><time dateTime={task.created_at}>{new Date(task.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></div></div><div className="task-status"><span className={`status-indicator status-${task.status}`} aria-hidden="true"/>{canUpdate ? <label className="sr-only" htmlFor={`status-${task.id}`}>Status for {task.title}</label> : <span className="sr-only">Status</span>}<select id={`status-${task.id}`} value={task.status} disabled={!canUpdate} onChange={(event) => void updateStatus(task.id, event.target.value as Task["status"])} aria-label={`Status for ${task.title}`}><option value="pending">{statuses.pending}</option><option value="in_progress">{statuses.in_progress}</option><option value="completed">{statuses.completed}</option></select></div></article>;
          })}</div>}
        </section>
        <footer className="dashboard-footer">Showing {tasks.length} {tasks.length === 1 ? "task" : "tasks"} visible to you</footer>
      </div>
    </main>
  );
}
