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

/** GET /v1/tunnels/tailscale — `tailscale serve` on the server host. The
 * mapping lives in tailscaled, so it survives server and host restarts. */
export type TailscaleStatus = {
  /** whether the tailscale CLI is on the server host's PATH */
  installed: boolean
  /** whether the host has joined a tailnet (`tailscale up`) */
  logged_in: boolean
  running: boolean
  /** private https://<machine>.<tailnet>.ts.net URL; empty when not served */
  url: string
}
