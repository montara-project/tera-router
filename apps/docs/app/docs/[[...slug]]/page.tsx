import { source } from "@/lib/source";
import { getMDXComponents } from "@/components/mdx-components";

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    return <h1>Page not found</h1>;
  }

  const MDXContent = page.data.body;

  return (
    <article className="prose">
      <h1>{page.data.title}</h1>
      <MDXContent components={getMDXComponents()} />
    </article>
  );
}
