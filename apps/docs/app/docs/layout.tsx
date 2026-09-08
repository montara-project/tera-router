import type { ReactNode } from "react";

import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{ title: "Tera Router" }}
      githubUrl="https://github.com/montara-project/tera-router"
    >
      {children}
    </DocsLayout>
  );
}
