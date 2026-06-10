<!--
  Pull request template — composed by the harness (refreshed manually
  from template/composed/.github/pull_request_template.md at v0.8.0;
  this file is NOT registered under composed.files in harness.config.json,
  so `harness sync` does not auto-rewrite it for this consumer — re-copy
  manually when adopting a future strict-schema bump).

  The block between the
  &lt;!-- harness:local-start id=... --&gt; ... &lt;!-- harness:local-end id=... --&gt;
  markers is the harness-tracked review-evidence section; consumer-owned
  content lives outside the markers.

  See OPERATIONS.md § Sync for the marker-block contract.
-->

## Summary

_(Write a concise description of what this PR does and why. One to three
sentences is usually enough. Remove this line before requesting review.)_

## Changes

_(Replace with a bullet list of the files and areas changed. Example:)_

- `path/to/file.ts` — _(what changed and why)_
- `path/to/other.ts` — _(what changed and why)_

## Testing

_(Describe how this was tested. Include at minimum:)_

- _(unit/integration tests added or updated, with file paths)_
- _(manual verification steps, if any)_
- _(CI checks expected to pass)_

<!-- harness:local-start id=pull-request.review-evidence -->
## Model audit

| Field | Value |
|---|---|
| Implementer models | _(comma-separated, e.g. claude-opus-4.7-xhigh, gpt-5.4)_ |
| Reviewer model | _(single id from C35-2 ladder, e.g. gpt-5.5)_ |
| Implementer agent | _(e.g. omni-si, yoga-si — the consumer-repo agent ID; suffix `-si` for sub-invaders, not `-ah`)_ |
| Reviewer agent | _(e.g. rubber-duck)_ |
| Notes | _(optional)_ |

## Review log

| timestamp | analyzed_head | actor | model | verdict | evidence_link |
|---|---|---|---|---|---|
| _(YYYY-MM-DDTHH:MM:SSZ)_ | _(40-char SHA)_ | _(actor)_ | _(model)_ | _(Go / Conditional Go / Needs-Fix)_ | _(URL or note)_ |
<!-- harness:local-end id=pull-request.review-evidence -->

## Notes

_(Optional. Use this section for caveats, follow-up items, or anything a
reviewer should know that doesn't fit above. Delete this section entirely
if there is nothing to add.)_
