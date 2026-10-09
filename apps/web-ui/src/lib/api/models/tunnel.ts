/** GET /v1/tunnels/cloudflare — the cloudflared quick tunnel on the server
 * host. The tunnel is in-memory: it ends with the server and gets a new URL
 * on every start. */
export type TunnelStatus = {
  /** whether the cloudflared binary is on the server host's PATH */
  installed: boolean
  running: boolean
  /** public *.trycloudflare.com URL; empty when not running */
  url: string
}
