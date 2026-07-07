import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { CrisisBanner } from "@/components/crisis-banner";
import { AuthProvider } from "@/components/auth-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AuthProvider>
      <div className="dark flex h-screen overflow-hidden bg-neutral-950">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <CrisisBanner />
          <main className="flex-1 overflow-y-auto bg-neutral-950">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
