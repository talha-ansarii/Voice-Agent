import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7F6] px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7209B7] text-lg font-bold text-white">
            A
          </div>
          <div>
            <p className="text-lg font-semibold text-[#0B132B]">Agent Studio</p>
            <p className="text-sm text-muted">Voice agents</p>
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-[#0B132B]">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Continue with Google to manage your voice agents, leads, and call logs.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-[#0B132B] px-4 py-3 text-sm font-medium text-white hover:bg-[#0B132B]/90"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
