import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8",
        className
      )}
    >
      {children}
    </div>
  );
}
