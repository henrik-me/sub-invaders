/**
 * scripts/verify-deploy.checks.example.mjs — Example check definitions.
 *
 * Each entry describes one named HTTP check. The main runner
 * (scripts/verify-deploy.mjs) imports this array and executes each check
 * in sequence against the deployed service.
 *
 * TODO: customize — rename this file to verify-deploy.checks.mjs and replace
 * these examples with checks that match your service's actual endpoints and
 * expected response shapes. Then update the import path in verify-deploy.mjs.
 *
 * Check shape:
 *   {
 *     name: string,     — short identifier; used with --checks filter
 *     path: string,     — URL path appended to the --url base
 *     expect: {
 *       status: number, — expected HTTP status code
 *       json?: (body: unknown, ctx: CheckContext) => string | null
 *                       — return a failure message, or null to pass
 *     }
 *   }
 *
 * @typedef {{ expectedVersion: string, baseUrl: string }} CheckContext
 * @module scripts/verify-deploy.checks.example.mjs
 */

const checks = [
  {
    // TODO: customize — update path to your version endpoint.
    name: 'version',
    path: '/api/version',
    expect: {
      status: 200,
      json: (body, ctx) => {
        if (typeof body.version !== 'string') {
          return 'response missing string field "version"';
        }
        if (body.version !== ctx.expectedVersion) {
          return `version mismatch: deployed "${body.version}", expected "${ctx.expectedVersion}"`;
        }
        return null;
      },
    },
  },
  {
    // TODO: customize — update path to your health endpoint.
    name: 'healthz',
    path: '/api/healthz',
    expect: {
      status: 200,
    },
  },
  {
    // TODO: customize — update path and assertions to your deploy-info endpoint.
    name: 'deploy-info',
    path: '/api/deploy-info',
    expect: {
      status: 200,
      json: (body) => {
        if (typeof body.deployedAt !== 'string' || body.deployedAt === '') {
          return 'response missing non-empty string field "deployedAt"';
        }
        if (typeof body.env !== 'string' || body.env === '') {
          return 'response missing non-empty string field "env"';
        }
        return null;
      },
    },
  },
];

export default checks;
