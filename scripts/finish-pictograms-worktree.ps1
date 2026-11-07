param([string]$PrimaryRoot = 'E:\Code\RimWorld')
$ErrorActionPreference = 'Stop'
$primary = (Resolve-Path -LiteralPath $PrimaryRoot).Path.TrimEnd('\')
$expectedTemp = [System.IO.Path]::GetFullPath((Join-Path $primary 'tmp')).TrimEnd('\')
$checkout = [System.IO.Path]::GetFullPath((Join-Path $expectedTemp 'pictograms-worktree'))
$metadata = [System.IO.Path]::GetFullPath((Join-Path $expectedTemp 'pictograms-isolated-repository'))
foreach ($target in @($checkout, $metadata)) {
    if ([System.IO.Path]::GetDirectoryName($target) -ne $expectedTemp) { throw "Chemin hors du répertoire attendu : $target" }
    if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw "Chemin absent : $target" }
    $resolved = (Resolve-Path -LiteralPath $target).Path
    if ($resolved -ne $target) { throw "Chemin résolu inattendu : $resolved" }
    if ((Get-Item -LiteralPath $target -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw "Jonction refusée : $target" }
}
$tip = & git "--git-dir=$metadata" rev-parse --verify refs/heads/art/pictograms-adult-handdrawn
if ($LASTEXITCODE -ne 0) { throw 'Branche de pictogrammes introuvable.' }
& git -C $primary merge-base --is-ancestor $tip HEAD
if ($LASTEXITCODE -ne 0) { throw 'Les pictogrammes ne sont pas encore fusionnés dans le HEAD principal.' }
$status = & git -C $checkout status --porcelain
if ($LASTEXITCODE -ne 0 -or $status) { throw 'Le worktree doit être propre avant suppression.' }
# Both recursive targets are verified absolute siblings inside the exact tmp
# directory above. Git removes its own registered checkout before metadata.
& git "--git-dir=$metadata" worktree remove $checkout
if ($LASTEXITCODE -ne 0) { throw 'Le retrait Git du worktree a échoué ; métadonnées conservées.' }
if (Test-Path -LiteralPath $checkout) { throw 'Worktree encore présent ; métadonnées conservées.' }
Remove-Item -LiteralPath $metadata -Recurse -Force
Write-Output 'Worktree de pictogrammes fusionné puis supprimé ; dépôt principal conservé.'
