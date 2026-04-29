param(
  [string]$CallflowDir = "D:\Documents(D)\3rdYR-2nd\CALLFLOW"
)

if (-not (Test-Path -LiteralPath $CallflowDir)) {
  Write-Output "CALLFLOW_NOT_FOUND: $CallflowDir"
  exit 1
}

Write-Output "CALLFLOW_DIR: $CallflowDir"
Get-ChildItem -LiteralPath $CallflowDir -File |
  Select-Object Name, Length, LastWriteTime |
  Format-Table -AutoSize

$txtFiles = Get-ChildItem -LiteralPath $CallflowDir -File -Filter *.txt
foreach ($file in $txtFiles) {
  Write-Output "`n===== BEGIN $($file.Name) ====="
  Get-Content -Raw -LiteralPath $file.FullName
  Write-Output "===== END $($file.Name) ====="
}
