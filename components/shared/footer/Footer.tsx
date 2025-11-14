import Link from "next/link";
import GcodeMonogram from "@/components/shared/icons/GcodeMonogram";

export default function Footer() {
  return (
    <footer className="border-t border-border-faint bg-background-base py-16 lg:py-24">
      <div className="container px-16">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <GcodeMonogram className="w-6 h-6" />
            <span className="text-label-medium text-accent-black">gcode.dev</span>
          </div>
          
          <div className="flex items-center gap-4 text-label-small text-black-alpha-56">
            <Link
              href="https://twitter.com/gcodedev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent-black transition-colors"
            >
              @gcodedev
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

