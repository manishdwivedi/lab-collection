#!/bin/bash
# ────────────────────────────────────────────────────────────
# LabCollect Database Backup Script
# Usage: chmod +x backup.sh && ./backup.sh
# Cron (daily at 2am): 0 2 * * * /var/app/labcollect/backend/backup.sh
# ────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config (load from .env if present) ──────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.env" ]; then
  export $(grep -v '^#' "${SCRIPT_DIR}/.env" | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-lab_collection}"

BACKUP_DIR="${SCRIPT_DIR}/backups"
KEEP_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

# ── Create backup directory ──────────────────────────────────
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting backup of ${DB_NAME}..."

# ── Dump and compress ────────────────────────────────────────
MYSQL_PWD="${DB_PASSWORD}" mysqldump \
  --host="${DB_HOST}" \
  --user="${DB_USER}" \
  --single-transaction \
  --routines \
  --triggers \
  --add-drop-table \
  "${DB_NAME}" | gzip > "${BACKUP_FILE}"

SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup complete: ${BACKUP_FILE} (${SIZE})"

# ── Remove old backups ───────────────────────────────────────
find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
echo "[$(date)] Cleaned up backups older than ${KEEP_DAYS} days"

# ── Optional: copy to remote (uncomment and configure) ───────
# aws s3 cp "${BACKUP_FILE}" "s3://your-bucket/db-backups/"
# scp "${BACKUP_FILE}" "user@backup-server:/backups/"

echo "[$(date)] Done."
