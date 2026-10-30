
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TaskDashboard from "./task-dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "User";

  return <TaskDashboard userName={userName} />;
}
