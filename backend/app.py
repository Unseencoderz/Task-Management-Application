
import os
from datetime import datetime, timezone
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from supabase import create_client

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not all([SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY]):
    raise RuntimeError("Missing Supabase environment variables.")

auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
db = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

VALID_STATUSES = {"pending", "in_progress", "completed"}


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ").strip()

        if not token or not header.startswith("Bearer "):
            return jsonify({"error": "Authentication required."}), 401

        try:
            response = auth_client.auth.get_user(token)
            if not response.user:
                return jsonify({"error": "Invalid access token."}), 401

            g.user_id = response.user.id
        except Exception:
            return jsonify({"error": "Invalid or expired access token."}), 401

        return fn(*args, **kwargs)

    return wrapper


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/users")
@require_auth
def get_users():
    try:
        result = (
            db.table("profiles")
            .select("id, full_name, email")
            .order("full_name")
            .execute()
        )
        return jsonify(result.data)
    except Exception:
        app.logger.exception("Failed to retrieve users")
        return jsonify({"error": "Could not retrieve users."}), 500


@app.post("/api/tasks")
@require_auth
def create_task():
    data = request.get_json(silent=True) or {}
    title = data.get("title")

    if not isinstance(title, str) or not title.strip():
        return jsonify({"error": "A task title is required."}), 400

    description = data.get("description")
    assigned_to = data.get("assigned_to")

    if description is not None and not isinstance(description, str):
        return jsonify({"error": "Description must be text."}), 400

    try:
        if assigned_to:
            assignee = (
                db.table("profiles")
                .select("id")
                .eq("id", assigned_to)
                .limit(1)
                .execute()
            )
            if not assignee.data:
                return jsonify({"error": "Assignee not found."}), 400

        result = (
            db.table("tasks")
            .insert({
                "title": title.strip(),
                "description": description,
                "created_by": g.user_id,
                "assigned_to": assigned_to or None,
            })
            .execute()
        )

        return jsonify(result.data[0]), 201

    except Exception:
        app.logger.exception("Failed to create task")
        return jsonify({"error": "Could not create task."}), 500


@app.get("/api/tasks")
@require_auth
def get_tasks():
    try:
        result = (
            db.table("tasks")
            .select("*")
            .or_(f"created_by.eq.{g.user_id},assigned_to.eq.{g.user_id}")
            .order("created_at", desc=True)
            .execute()
        )
        return jsonify(result.data)
    except Exception:
        app.logger.exception("Failed to retrieve tasks")
        return jsonify({"error": "Could not retrieve tasks."}), 500


@app.patch("/api/tasks/<task_id>")
@require_auth
def update_task(task_id):
    data = request.get_json(silent=True) or {}

    allowed_fields = {"title", "description", "status", "assigned_to"}
    if not data or set(data) - allowed_fields:
        return jsonify({"error": "Invalid task fields."}), 400

    try:
        result = (
            db.table("tasks")
            .select("*")
            .eq("id", task_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            return jsonify({"error": "Task not found."}), 404

        task = result.data[0]
        is_creator = task["created_by"] == g.user_id
        is_assignee = task["assigned_to"] == g.user_id

        if not is_creator and not is_assignee:
            return jsonify({"error": "Permission denied."}), 403

        if not is_creator and set(data) != {"status"}:
            return jsonify({
                "error": "Assignees can only update task status."
            }), 403

        updates = {}

        if "title" in data:
            title = data["title"]
            if not isinstance(title, str) or not title.strip():
                return jsonify({"error": "A task title is required."}), 400
            updates["title"] = title.strip()

        if "description" in data:
            if data["description"] is not None and not isinstance(
                data["description"], str
            ):
                return jsonify({"error": "Description must be text."}), 400
            updates["description"] = data["description"]

        if "assigned_to" in data:
            assignee_id = data["assigned_to"]

            if assignee_id:
                assignee = (
                    db.table("profiles")
                    .select("id")
                    .eq("id", assignee_id)
                    .limit(1)
                    .execute()
                )
                if not assignee.data:
                    return jsonify({"error": "Assignee not found."}), 400

            updates["assigned_to"] = assignee_id or None

        if "status" in data:
            status = data["status"]
            if status not in VALID_STATUSES:
                return jsonify({"error": "Invalid task status."}), 400

            updates["status"] = status
            updates["completed_at"] = (
                datetime.now(timezone.utc).isoformat()
                if status == "completed"
                else None
            )

        updated = (
            db.table("tasks")
            .update(updates)
            .eq("id", task_id)
            .execute()
        )

        return jsonify(updated.data[0])

    except Exception:
        app.logger.exception("Failed to update task")
        return jsonify({"error": "Could not update task."}), 500


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True,
        use_reloader=False,
    )
