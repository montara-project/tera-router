// @ts-nocheck
import * as __fd_glob_22 from "../content/docs/getting-started/installation.mdx?collection=docs"
import * as __fd_glob_21 from "../content/docs/getting-started/dashboard.mdx?collection=docs"
import * as __fd_glob_20 from "../content/docs/gateway/streaming.mdx?collection=docs"
import * as __fd_glob_19 from "../content/docs/gateway/responses.mdx?collection=docs"
import * as __fd_glob_18 from "../content/docs/gateway/model-addressing.mdx?collection=docs"
import * as __fd_glob_17 from "../content/docs/gateway/messages.mdx?collection=docs"
import * as __fd_glob_16 from "../content/docs/gateway/index.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/gateway/errors.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/gateway/chat-completions.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/concepts/skills.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/concepts/routing.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/concepts/providers.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/concepts/plans-budgets.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/concepts/guardrails.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/concepts/api-keys.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/api-reference/dashboard-api.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/configuration.mdx?collection=docs"
import { default as __fd_glob_4 } from "../content/docs/getting-started/meta.json?collection=docs"
import { default as __fd_glob_3 } from "../content/docs/gateway/meta.json?collection=docs"
import { default as __fd_glob_2 } from "../content/docs/concepts/meta.json?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/api-reference/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "api-reference/meta.json": __fd_glob_1, "concepts/meta.json": __fd_glob_2, "gateway/meta.json": __fd_glob_3, "getting-started/meta.json": __fd_glob_4, }, {"configuration.mdx": __fd_glob_5, "index.mdx": __fd_glob_6, "api-reference/dashboard-api.mdx": __fd_glob_7, "concepts/api-keys.mdx": __fd_glob_8, "concepts/guardrails.mdx": __fd_glob_9, "concepts/plans-budgets.mdx": __fd_glob_10, "concepts/providers.mdx": __fd_glob_11, "concepts/routing.mdx": __fd_glob_12, "concepts/skills.mdx": __fd_glob_13, "gateway/chat-completions.mdx": __fd_glob_14, "gateway/errors.mdx": __fd_glob_15, "gateway/index.mdx": __fd_glob_16, "gateway/messages.mdx": __fd_glob_17, "gateway/model-addressing.mdx": __fd_glob_18, "gateway/responses.mdx": __fd_glob_19, "gateway/streaming.mdx": __fd_glob_20, "getting-started/dashboard.mdx": __fd_glob_21, "getting-started/installation.mdx": __fd_glob_22, });