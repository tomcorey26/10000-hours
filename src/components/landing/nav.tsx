import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_NAME_SHORT } from "@/data/app";

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b border-border/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/icon.webp" alt={APP_NAME_SHORT} width={28} height={28} />
          <span className="font-mono font-semibold text-foreground">
            {APP_NAME}
          </span>
        </Link>
        <Button asChild size="sm">
          <Link href="/login">Get Started</Link>
        </Button>
      </div>
    </nav>
  );
}
