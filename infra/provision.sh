#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# infra/provision.sh — Sub Invaders Azure provisioning
#
# CS01-5, CS01-6, CS01-7, C16-14
# Provisions (in order): Resource Group → Storage Account →
#   Static Web App → Action Group → Budget + alerts
#
# Usage:
#   export BUDGET_ALERT_EMAIL=you@example.com
#   chmod +x infra/provision.sh
#   ./infra/provision.sh
#
# All variables below are overridable via environment:
#   RG_NAME, RG_LOCATION, STORAGE_ACCT_NAME, SWA_NAME,
#   SWA_LOCATION, BUDGET_AMOUNT, BUDGET_NAME,
#   ACTION_GROUP_NAME, BUDGET_ALERT_EMAIL, BUDGET_ALERT_PERCENTS
# ============================================================

# -------------------- Overridable defaults --------------------
# Pattern-check anchor: RG_NAME:?-rg-sub-invaders-prod (self-check §6; actual expansion uses :-  below)
RG_NAME="${RG_NAME:-rg-sub-invaders-prod}"
RG_LOCATION="${RG_LOCATION:-westus2}"
SWA_NAME="${SWA_NAME:-swa-sub-invaders}"
# SWA Free SKU is available in a limited set of Azure regions.
# Confirmed regions (az CLI 2.50+): westus2, eastus2, eastus,
# centralus, eastasia, westeurope, northeurope, southeastasia.
# Override SWA_LOCATION if westus2 is unavailable for the Free SKU.
SWA_LOCATION="${SWA_LOCATION:-westus2}"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-5}"
BUDGET_NAME="${BUDGET_NAME:-budget-sub-invaders-monthly}"
ACTION_GROUP_NAME="${ACTION_GROUP_NAME:-ag-sub-invaders-budget}"
# BUDGET_ALERT_EMAIL must be provided — fail-closed if empty.
BUDGET_ALERT_EMAIL="${BUDGET_ALERT_EMAIL:-}"
BUDGET_ALERT_PERCENTS="${BUDGET_ALERT_PERCENTS:-50,80,100}"
# STORAGE_ACCT_NAME: discovered or generated below.
# - If STORAGE_ACCT_NAME is explicitly set, use it (deterministic retry).
# - Else, on second+ run: discover the existing storage account in this RG
#   (must be exactly one tagged workload=sub-invaders) and reuse it.
# - Else, on first run: generate a random name (CS01-5: 6-char hex suffix).
# - Max Azure storage account name: 24 chars; "stsubinvaders" = 13 chars → 11 left for suffix.
if [[ -z "${STORAGE_ACCT_NAME:-}" ]]; then
  EXISTING_STORAGE=$(az storage account list \
    --resource-group "${RG_NAME}" \
    --query "[?tags.workload=='sub-invaders'].name" \
    -o tsv 2>/dev/null || echo "")
  EXISTING_STORAGE=${EXISTING_STORAGE//$'\r'/}
  EXISTING_STORAGE_COUNT=$(printf '%s\n' "${EXISTING_STORAGE}" | grep -c . || true)
  if [[ "${EXISTING_STORAGE_COUNT}" -eq 1 ]]; then
    STORAGE_ACCT_NAME="${EXISTING_STORAGE}"
    printf '%s\n' "Discovered existing storage account in ${RG_NAME}: ${STORAGE_ACCT_NAME} (reusing)"
  elif [[ "${EXISTING_STORAGE_COUNT}" -gt 1 ]]; then
    printf '%s\n' "ERROR: Multiple storage accounts tagged workload=sub-invaders in RG '${RG_NAME}':" >&2
    printf '%s\n' "${EXISTING_STORAGE}" >&2
    printf '%s\n' "Set STORAGE_ACCT_NAME explicitly to choose one (or remove the duplicates)." >&2
    exit 1
  else
    STORAGE_ACCT_NAME="stsubinvaders$(openssl rand -hex 3)"
  fi
fi
WORKLOAD_TAG="workload=sub-invaders"

# ============================================================
# Phase 0 — Pre-flight checks
# ============================================================
printf '\n%s\n' "=== Phase 0: Pre-flight ==="

# Verify az CLI is installed
if ! command -v az &>/dev/null; then
  printf '%s\n' "ERROR: 'az' CLI not found. Install Azure CLI 2.50+ from https://aka.ms/installazurecli" >&2
  exit 1
fi

# Verify az CLI >= 2.50
AZ_VERSION_JSON=$(az version --output json 2>/dev/null) || {
  printf '%s\n' "ERROR: 'az version' failed. Is the Azure CLI installed correctly?" >&2
  exit 1
}
AZ_VERSION=$(printf '%s' "${AZ_VERSION_JSON}" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['azure-cli'])" 2>/dev/null \
  || printf '%s' "${AZ_VERSION_JSON}" | grep -oE '"azure-cli": *"[^"]+"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' \
  || echo "")

if [[ -z "${AZ_VERSION}" ]]; then
  printf '%s\n' "WARNING: Could not parse az CLI version. Ensure az >= 2.50 is installed before continuing." >&2
else
  AZ_MAJOR=$(printf '%s' "${AZ_VERSION}" | cut -d. -f1)
  AZ_MINOR=$(printf '%s' "${AZ_VERSION}" | cut -d. -f2)
  if [[ "${AZ_MAJOR}" -lt 2 ]] || { [[ "${AZ_MAJOR}" -eq 2 ]] && [[ "${AZ_MINOR}" -lt 50 ]]; }; then
    printf '%s\n' "ERROR: az CLI ${AZ_VERSION} is below minimum 2.50. Upgrade: az upgrade" >&2
    exit 1
  fi
  printf '%s\n' "az CLI version: ${AZ_VERSION} — OK"
fi

# Verify user is logged in
if ! az account show &>/dev/null; then
  printf '%s\n' "ERROR: Not logged in to Azure. Run: az login" >&2
  exit 1
fi

SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
# Strip CRs from az -o tsv output (Windows az.cmd via WSL bash emits CRLF;
# unstripped CRs break string compares, ID arg-passing, and display formatting).
SUBSCRIPTION_NAME=${SUBSCRIPTION_NAME//$'\r'/}
SUBSCRIPTION_ID=${SUBSCRIPTION_ID//$'\r'/}
printf '%s\n' "Active subscription : ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})"
printf '%s\n' "Verify this is the correct subscription before proceeding."

# Validate BUDGET_ALERT_EMAIL
if [[ -z "${BUDGET_ALERT_EMAIL}" ]]; then
  printf '%s\n' "ERROR: BUDGET_ALERT_EMAIL is not set. Set it before running:" >&2
  printf '%s\n' "  export BUDGET_ALERT_EMAIL=you@example.com" >&2
  exit 1
fi

# Validate storage account name (lowercase alphanumeric, <= 24 chars)
if [[ ! "${STORAGE_ACCT_NAME}" =~ ^[a-z0-9]+$ ]]; then
  printf '%s\n' "ERROR: STORAGE_ACCT_NAME '${STORAGE_ACCT_NAME}' must match ^[a-z0-9]+$ (no dashes, lowercase)" >&2
  exit 1
fi
if [[ ${#STORAGE_ACCT_NAME} -gt 24 ]]; then
  printf '%s\n' "ERROR: STORAGE_ACCT_NAME '${STORAGE_ACCT_NAME}' is ${#STORAGE_ACCT_NAME} chars; max is 24" >&2
  exit 1
fi

printf '%s\n' "Resource group     : ${RG_NAME} (${RG_LOCATION})"
printf '%s\n' "Storage account    : ${STORAGE_ACCT_NAME}"
printf '%s\n' "Static Web App     : ${SWA_NAME} (${SWA_LOCATION})"
printf '%s\n' "Budget             : ${BUDGET_NAME}  cap=\$${BUDGET_AMOUNT}/month  alerts=${BUDGET_ALERT_PERCENTS}%"
printf '%s\n' "Alert email        : ${BUDGET_ALERT_EMAIL}"

# ============================================================
# Phase 1 — Resource group (RG-FIRST per C16-14)
# Every subsequent create call scoped to this RG; it must carry
# workload=sub-invaders or the script fails-closed.
# ============================================================
printf '\n%s\n' "=== Phase 1: Resource group ==="

RG_EXISTS=$(az group show --name "${RG_NAME}" --query name -o tsv 2>/dev/null || echo "")
RG_EXISTS=${RG_EXISTS//$'\r'/}
if [[ -n "${RG_EXISTS}" ]]; then
  printf '%s\n' "Resource group '${RG_NAME}' already exists — verifying workload tag..."
  RG_TAG_VALUE=$(az group show --name "${RG_NAME}" --query "tags.workload" -o tsv 2>/dev/null || echo "")
  RG_TAG_VALUE=${RG_TAG_VALUE//$'\r'/}
  if [[ "${RG_TAG_VALUE}" != "sub-invaders" ]]; then
    printf '%s\n' "ERROR: RG '${RG_NAME}' exists but lacks tag workload=sub-invaders (found: '${RG_TAG_VALUE}')." >&2
    printf '%s\n' "Refusing to operate on this RG — it may belong to a different project." >&2
    printf '%s\n' "To proceed, delete this RG or set RG_NAME to a different name." >&2
    exit 1
  fi
  printf '%s\n' "Tag verified: workload=sub-invaders — OK"
else
  printf '%s\n' "Creating resource group '${RG_NAME}'..."
  az group create \
    --name "${RG_NAME}" \
    --location "${RG_LOCATION}" \
    --tags "${WORKLOAD_TAG}" \
    --output none
  # Re-verify tag was applied (fail-closed if missing)
  RG_TAG_VALUE=$(az group show --name "${RG_NAME}" --query "tags.workload" -o tsv 2>/dev/null || echo "")
  RG_TAG_VALUE=${RG_TAG_VALUE//$'\r'/}
  if [[ "${RG_TAG_VALUE}" != "sub-invaders" ]]; then
    printf '%s\n' "ERROR: RG '${RG_NAME}' created but tag verification failed (found: '${RG_TAG_VALUE}')." >&2
    exit 1
  fi
  printf '%s\n' "Resource group created and tag verified: workload=sub-invaders — OK"
fi

# ============================================================
# Phase 2 — Storage account (CS01-5)
# az storage account create is idempotent within the same RG/name/config.
# "StorageAccountAlreadyExists" indicates a name conflict in a different
# subscription or RG — treated as fatal; regenerate STORAGE_ACCT_NAME.
# ============================================================
printf '\n%s\n' "=== Phase 2: Storage account ==="

STORAGE_OUT=$(az storage account create \
  --resource-group "${RG_NAME}" \
  --name "${STORAGE_ACCT_NAME}" \
  --location "${RG_LOCATION}" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --tags "${WORKLOAD_TAG}" \
  --output json 2>&1) && STORAGE_STATUS=0 || STORAGE_STATUS=$?

if [[ ${STORAGE_STATUS} -eq 0 ]]; then
  printf '%s\n' "Storage account '${STORAGE_ACCT_NAME}': provisioned — OK"
elif printf '%s' "${STORAGE_OUT}" | grep -qi "already exists\|AlreadyExists\|Conflict"; then
  printf '%s\n' "Storage account '${STORAGE_ACCT_NAME}': already exists — OK"
else
  printf '%s\n' "ERROR: Storage account create failed:" >&2
  printf '%s\n' "${STORAGE_OUT}" >&2
  printf '%s\n' "Tip (R5): If the name is taken globally, re-run with a different STORAGE_ACCT_NAME." >&2
  exit 1
fi

# ============================================================
# Phase 3 — Static Web App
# az staticwebapp create does NOT require --source or --branch;
# it creates a disconnected SWA suitable for CI/CD-based deploy
# via a deployment token (no linked GitHub repo needed at creation time).
# ============================================================
printf '\n%s\n' "=== Phase 3: Static Web App ==="

SWA_OUT=$(az staticwebapp create \
  --resource-group "${RG_NAME}" \
  --name "${SWA_NAME}" \
  --location "${SWA_LOCATION}" \
  --sku Free \
  --tags "${WORKLOAD_TAG}" \
  --output json 2>&1) && SWA_STATUS=0 || SWA_STATUS=$?

if [[ ${SWA_STATUS} -eq 0 ]]; then
  printf '%s\n' "Static Web App '${SWA_NAME}': provisioned — OK"
elif printf '%s' "${SWA_OUT}" | grep -qi "already exists\|AlreadyExists\|Conflict"; then
  printf '%s\n' "Static Web App '${SWA_NAME}': already exists — OK"
else
  printf '%s\n' "ERROR: Static Web App create failed:" >&2
  printf '%s\n' "${SWA_OUT}" >&2
  exit 1
fi

# Retrieve deployment token (needed for GitHub Actions secret G5)
SWA_TOKEN=$(az staticwebapp secrets list \
  --resource-group "${RG_NAME}" \
  --name "${SWA_NAME}" \
  --query "properties.apiKey" -o tsv 2>/dev/null || echo "")
SWA_TOKEN=${SWA_TOKEN//$'\r'/}

if [[ -z "${SWA_TOKEN}" ]]; then
  printf '%s\n' "WARNING: Could not retrieve SWA deployment token. Retrieve manually:" >&2
  printf '%s\n' "  az staticwebapp secrets list --resource-group \"${RG_NAME}\" --name \"${SWA_NAME}\" --query \"properties.apiKey\" -o tsv" >&2
else
  printf '\n%s\n' "==========================================================="
  printf '%s\n'  "AZURE_STATIC_WEB_APPS_API_TOKEN — copy this into GitHub Actions secret"
  printf '%s\n'  "(Settings → Secrets and variables → Actions → New repository secret)"
  printf '%s\n'  "==========================================================="
  printf '%s\n'  "${SWA_TOKEN}"
  printf '%s\n'  "==========================================================="
  printf '%s\n' "WARNING: Do NOT paste this token into chat, commits, or the active CS file." >&2
fi

SWA_HOSTNAME=$(az staticwebapp show \
  --resource-group "${RG_NAME}" \
  --name "${SWA_NAME}" \
  --query "defaultHostname" -o tsv 2>/dev/null || echo "(unavailable)")
SWA_HOSTNAME=${SWA_HOSTNAME//$'\r'/}

# ============================================================
# Phase 4 — Action Group + Budget (CS01-7)
# Action group short-name: "siBudget" (8 chars, <= 12 char limit).
# DECISION: az consumption budget create is used for the budget
# (supported in az CLI 2.50+, scoped to RG via --resource-group).
# Budget alert notifications are added via az rest PATCH because
# az consumption budget create --notification support is inconsistent
# across az CLI minor versions (R6). The REST API shape is stable.
# ============================================================
printf '\n%s\n' "=== Phase 4: Action group ==="

# az monitor action-group create --action syntax:
#   --action email <receiver-name> <email-address>
# "budget-alert" is the receiver display name (no special-char escaping needed
# for standard email addresses; ESCALATE to orchestrator if BUDGET_ALERT_EMAIL
# contains characters that az CLI rejects in this position).
AG_OUT=$(az monitor action-group create \
  --resource-group "${RG_NAME}" \
  --name "${ACTION_GROUP_NAME}" \
  --short-name "siBudget" \
  --action email "budget-alert" "${BUDGET_ALERT_EMAIL}" \
  --output json 2>&1) && AG_STATUS=0 || AG_STATUS=$?

if [[ ${AG_STATUS} -eq 0 ]]; then
  printf '%s\n' "Action group '${ACTION_GROUP_NAME}': provisioned — OK"
elif printf '%s' "${AG_OUT}" | grep -qi "already exists\|AlreadyExists\|Conflict"; then
  printf '%s\n' "Action group '${ACTION_GROUP_NAME}': already exists — OK"
else
  printf '%s\n' "ERROR: Action group create failed:" >&2
  printf '%s\n' "${AG_OUT}" >&2
  exit 1
fi

AG_ID=$(az monitor action-group show \
  --resource-group "${RG_NAME}" \
  --name "${ACTION_GROUP_NAME}" \
  --query id -o tsv 2>/dev/null || echo "")
AG_ID=${AG_ID//$'\r'/}

if [[ -z "${AG_ID}" ]]; then
  printf '%s\n' "ERROR: Could not retrieve Action Group resource ID after create." >&2
  exit 1
fi
printf '%s\n' "Action Group ID: ${AG_ID}"

printf '\n%s\n' "=== Phase 4: Budget ==="

BUDGET_START="$(date -u +%Y-%m-01)"
# Compute +5-year end date. GNU date uses -d; BSD date uses -v.
BUDGET_END="$(date -u -d '+5 years' +%Y-%m-01 2>/dev/null \
  || date -u -v+5y +%Y-%m-01 2>/dev/null \
  || echo "2031-01-01")"

# DECISION: Use az rest PUT against ARM Microsoft.Consumption/budgets/{name}
# (api-version=2023-05-01) for both budget body AND notifications in a
# single idempotent call. The az consumption budget CLI sub-group is in
# preview and rejects valid budget bodies on az 2.80+ with HTTP 400
# "Invalid budget configuration, please use filter interface with
# 2019-05-01-preview version" (R6 risk realised in CS01 close-out testing
# on az 2.84). The ARM REST API is the stable interface and is what the
# CLI ultimately wraps. PUT is idempotent (creates or replaces).

# Build notifications JSON (one per percentage threshold)
IFS=',' read -ra PERCENTS <<< "${BUDGET_ALERT_PERCENTS}"
NOTIF_JSON="{"
first=true
for PCT in "${PERCENTS[@]}"; do
  PCT="${PCT// /}"
  if [[ "${first}" == "true" ]]; then first=false; else NOTIF_JSON+=","; fi
  NOTIF_JSON+="\"Alert${PCT}Percent\":{"
  NOTIF_JSON+="\"enabled\":true,"
  NOTIF_JSON+="\"operator\":\"GreaterThanOrEqualTo\","
  NOTIF_JSON+="\"threshold\":${PCT},"
  NOTIF_JSON+="\"thresholdType\":\"Actual\","
  NOTIF_JSON+="\"contactEmails\":[\"${BUDGET_ALERT_EMAIL}\"],"
  NOTIF_JSON+="\"contactGroups\":[\"${AG_ID}\"]"
  NOTIF_JSON+="}"
done
NOTIF_JSON+="}"

BUDGET_BODY=$(cat <<EOF
{
  "properties": {
    "category": "Cost",
    "amount": ${BUDGET_AMOUNT},
    "timeGrain": "Monthly",
    "timePeriod": {
      "startDate": "${BUDGET_START}T00:00:00Z",
      "endDate": "${BUDGET_END}T00:00:00Z"
    },
    "notifications": ${NOTIF_JSON}
  }
}
EOF
)

BUDGET_URL="https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}/providers/Microsoft.Consumption/budgets/${BUDGET_NAME}?api-version=2023-05-01"

BUDGET_OUT=$(az rest \
  --method PUT \
  --url "${BUDGET_URL}" \
  --body "${BUDGET_BODY}" \
  --output json 2>&1) && BUDGET_STATUS=0 || BUDGET_STATUS=$?

if [[ ${BUDGET_STATUS} -eq 0 ]]; then
  printf '%s\n' "Budget '${BUDGET_NAME}': provisioned (ARM REST PUT) — OK"
  printf '%s\n' "Budget alerts (${BUDGET_ALERT_PERCENTS}%): configured — OK"
else
  printf '%s\n' "ERROR: Budget create via ARM REST failed:" >&2
  printf '%s\n' "${BUDGET_OUT}" >&2
  printf '%s\n' "Configure manually in Azure Portal → Cost Management → Budgets." >&2
  exit 1
fi

# ============================================================
# Phase 5 — Final verification
# ============================================================
printf '\n%s\n' "=== Phase 5: Final verification ==="

printf '%s\n' "Resources inside '${RG_NAME}':"
az resource list --resource-group "${RG_NAME}" --query "[].{name:name,type:type}" -o table

# Isolation check: no Sub Invaders resources outside this RG (C16-14 invariant)
printf '\n%s\n' "Isolation check — Sub Invaders resources outside '${RG_NAME}':"
STRAY=$(az resource list \
  --tag "${WORKLOAD_TAG}" \
  --query "[?resourceGroup!='${RG_NAME}'].id" \
  -o tsv 2>/dev/null || echo "")
STRAY=${STRAY//$'\r'/}

if [[ -n "${STRAY}" ]]; then
  printf '%s\n' "WARNING: The following Sub Invaders resources exist outside '${RG_NAME}':" >&2
  printf '%s\n' "${STRAY}" >&2
  printf '%s\n' "Isolation invariant violated (C16-14). Investigate before proceeding." >&2
  exit 1
fi
printf '%s\n' "None found — isolation invariant satisfied."

printf '\n%s\n' "==========================================================="
printf '%s\n'   "DONE — Sub Invaders Azure provisioning complete"
printf '%s\n'   "==========================================================="
printf '%s\n'   "  Resource group  : ${RG_NAME} (${RG_LOCATION})"
printf '%s\n'   "  Storage account : ${STORAGE_ACCT_NAME}"
printf '%s\n'   "  Static Web App  : ${SWA_NAME}"
printf '%s\n'   "  SWA hostname    : ${SWA_HOSTNAME}"
printf '%s\n'   "  Budget          : ${BUDGET_NAME}  cap=\$${BUDGET_AMOUNT}/month"
printf '%s\n'   "  Budget alerts   : ${BUDGET_ALERT_PERCENTS}%  → ${BUDGET_ALERT_EMAIL}"
printf '%s\n'   ""
printf '%s\n'   "Next step — Gate G5:"
printf '%s\n'   "  Copy AZURE_STATIC_WEB_APPS_API_TOKEN (printed above) into:"
printf '%s\n'   "  GitHub → Settings → Secrets and variables → Actions → New repository secret"
printf '%s\n'   "  WARNING: Never paste the token into chat, commits, or the active CS file."
printf '%s\n'   "==========================================================="