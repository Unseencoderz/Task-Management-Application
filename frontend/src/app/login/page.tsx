import SignIn from "../sign-in";

export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const authError = error === "missing_code"
    ? "The sign-in link was incomplete. Please try again."
    : error
      ? "Google sign-in could not be completed. Please try again."
      : "";
  return <SignIn authError={authError} />;
}

