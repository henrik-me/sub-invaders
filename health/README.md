# Health check conventions

## Liveness vs readiness

**Liveness** answers: "Is the process up and the event loop responsive?"

- No external I/O required.
- Failing liveness means the process should be restarted.
- Implement in `checkLiveness()` in `handler.mjs`.

**Readiness** answers: "Can this instance serve production traffic right now?"

- Requires all critical dependencies to be reachable (database, cache, downstream services).
- Failing readiness means the instance should be removed from the load-balancer rotation
  but NOT restarted.
- Implement dependency probes in `checkReadiness()` in `handler.mjs`.

## Response shape

```json
{ "status": "ok",    "checks": { "database": "ok", "downstream": "ok" } }
{ "status": "error", "checks": { "database": "fail" } }
```

The default probe runner (`scripts/health-probe.mjs`) expects HTTP 200 with
`{ "status": "ok" }`. Adjust `--expect-key` / `--expect-value` flags or the
handler response shape so both sides agree.

## Endpoint convention

Expose a single `/health` endpoint. Orchestrators and load balancers call it directly.
If your platform requires separate liveness and readiness endpoints (e.g., Kubernetes
`livenessProbe` vs `readinessProbe`), split the handler into `/health/live` and
`/health/ready` and update the probe runner `--url` accordingly.
