// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"configuration.mdx": () => import("../content/docs/configuration.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "api-reference/dashboard-api.mdx": () => import("../content/docs/api-reference/dashboard-api.mdx?collection=docs"), "concepts/api-keys.mdx": () => import("../content/docs/concepts/api-keys.mdx?collection=docs"), "concepts/guardrails.mdx": () => import("../content/docs/concepts/guardrails.mdx?collection=docs"), "concepts/plans-budgets.mdx": () => import("../content/docs/concepts/plans-budgets.mdx?collection=docs"), "concepts/providers.mdx": () => import("../content/docs/concepts/providers.mdx?collection=docs"), "concepts/routing.mdx": () => import("../content/docs/concepts/routing.mdx?collection=docs"), "concepts/skills.mdx": () => import("../content/docs/concepts/skills.mdx?collection=docs"), "gateway/chat-completions.mdx": () => import("../content/docs/gateway/chat-completions.mdx?collection=docs"), "gateway/errors.mdx": () => import("../content/docs/gateway/errors.mdx?collection=docs"), "gateway/index.mdx": () => import("../content/docs/gateway/index.mdx?collection=docs"), "gateway/messages.mdx": () => import("../content/docs/gateway/messages.mdx?collection=docs"), "gateway/model-addressing.mdx": () => import("../content/docs/gateway/model-addressing.mdx?collection=docs"), "gateway/responses.mdx": () => import("../content/docs/gateway/responses.mdx?collection=docs"), "gateway/streaming.mdx": () => import("../content/docs/gateway/streaming.mdx?collection=docs"), "getting-started/dashboard.mdx": () => import("../content/docs/getting-started/dashboard.mdx?collection=docs"), "getting-started/installation.mdx": () => import("../content/docs/getting-started/installation.mdx?collection=docs"), }),
};
export default browserCollections;