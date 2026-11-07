# EPHPHATHA GITHUB REPOSITORY & GITHUB PAGES PUBLISH SCRIPT
# Usage: Run in PowerShell from c:\Antygravity\Ephphatha

param(
  [string]$RepoUrl = "https://github.com/YOUR_USERNAME/Ephphatha.git"
)

Write-Host "=== Initializing Ephphatha Git Repository ===" -ForegroundColor Cyan
if (-not (Test-Path ".git")) {
  git init
  git branch -M main
}

git add .
git commit -m "feat(ephphatha): v3.0 Enterprise Local-First Bible in a Year PWA & Setup Suite"

Write-Host "=== Ready to push to $RepoUrl ===" -ForegroundColor Green
Write-Host "Run the following commands after creating the 'Ephphatha' repo on GitHub:"
Write-Host "  git remote add origin $RepoUrl"
Write-Host "  git push -u origin main"

