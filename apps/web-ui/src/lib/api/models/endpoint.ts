/** One HTTP route an application can call, as listed on the Endpoints page. */
export type EndpointRoute = {
  method: string
  path: string
  description: string
  /** upstream API the route speaks, when it speaks one */
  provider?: string
}

/** A group of routes. `auth` is false for routes that need no API key. */
export type EndpointGroup = {
  title: string
  auth: boolean
  routes: EndpointRoute[]
}

/** GET /v1/endpoints — the origin the request arrived on and the route reference. */
export type EndpointCatalog = {
  base_url: string
  groups: EndpointGroup[]
}
