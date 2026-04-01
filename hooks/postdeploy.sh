#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="skills"
STORAGE_ACCOUNT="${AZURE_BLOB_STORAGE_ACCOUNT_NAME:-}"
USE_CASES_DIR="use-cases"

if [ -z "$STORAGE_ACCOUNT" ]; then
  echo "⚠️  AZURE_BLOB_STORAGE_ACCOUNT_NAME is not set. Skipping skills upload."
  exit 0
fi

if [ ! -d "$USE_CASES_DIR" ]; then
  echo "⚠️  '$USE_CASES_DIR' directory not found. Skipping skills upload."
  exit 0
fi

# Discover available use-cases
USE_CASES=()
for dir in "$USE_CASES_DIR"/*/; do
  name="$(basename "$dir")"
  [ "$name" = "*" ] && continue
  USE_CASES+=("$name")
done

if [ ${#USE_CASES[@]} -eq 0 ]; then
  echo "⚠️  No use-cases found in '$USE_CASES_DIR'. Skipping skills upload."
  exit 0
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          Upload Skills to Azure Blob Storage            ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Storage Account: $STORAGE_ACCOUNT"
echo "║  Container:       $CONTAINER_NAME"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Available use-cases:"
echo ""
for i in "${!USE_CASES[@]}"; do
  echo "  $((i + 1)). ${USE_CASES[$i]}"
done
echo "  A. All use-cases"
echo "  S. Skip (do not upload)"
echo ""

read -r -p "Select use-case(s) to upload (number, A for all, S to skip): " SELECTION

if [[ "$SELECTION" =~ ^[Ss]$ ]]; then
  echo "Skipping skills upload."
  exit 0
fi

SELECTED=()
if [[ "$SELECTION" =~ ^[Aa]$ ]]; then
  SELECTED=("${USE_CASES[@]}")
else
  # Support comma-separated numbers like "1,3"
  IFS=',' read -ra NUMS <<< "$SELECTION"
  for num in "${NUMS[@]}"; do
    num="$(echo "$num" | tr -d ' ')"
    if [[ "$num" =~ ^[0-9]+$ ]] && [ "$num" -ge 1 ] && [ "$num" -le "${#USE_CASES[@]}" ]; then
      SELECTED+=("${USE_CASES[$((num - 1))]}")
    else
      echo "⚠️  Invalid selection: $num"
    fi
  done
fi

if [ ${#SELECTED[@]} -eq 0 ]; then
  echo "No valid use-cases selected. Skipping."
  exit 0
fi

for use_case in "${SELECTED[@]}"; do
  LOCAL_PATH="$USE_CASES_DIR/$use_case"
  echo ""
  echo "🔄 Uploading '$use_case' → blob://$CONTAINER_NAME/$use_case/ ..."

  # Delete existing blobs for this use-case first (replace, not merge)
  echo "   Clearing existing blobs under '$use_case/'..."
  az storage blob delete-batch \
    --account-name "$STORAGE_ACCOUNT" \
    --source "$CONTAINER_NAME" \
    --pattern "$use_case/*" \
    --auth-mode login \
    --only-show-errors 2>/dev/null || true

  # Upload all files from the local use-case folder
  az storage blob upload-batch \
    --account-name "$STORAGE_ACCOUNT" \
    --destination "$CONTAINER_NAME" \
    --source "$LOCAL_PATH" \
    --destination-path "$use_case" \
    --auth-mode login \
    --overwrite \
    --only-show-errors

  echo "   ✅ '$use_case' uploaded successfully."
done

echo ""
echo "🎉 Skills upload complete."
