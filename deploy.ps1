param([ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]*$')][string]$RepositoryName = 'sports-frontier')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  $ghInstalled = 'C:/Program Files/GitHub CLI/gh.exe'
  if (Test-Path -LiteralPath $ghInstalled) { $env:PATH = "C:/Program Files/GitHub CLI;$env:PATH" }
  else {
    $portableGh = Join-Path $PSScriptRoot '../../work/gh/bin/gh.exe'
    if (Test-Path -LiteralPath $portableGh) { $env:PATH = "$(Split-Path -Parent $portableGh);$env:PATH" }
    else { throw '请先安装免费 GitHub CLI：winget install --id GitHub.cli --exact，然后重新打开终端。' }
  }
}
function Invoke-Gh {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
  $result = & gh @Arguments
  if ($LASTEXITCODE -ne 0) { throw "GitHub 操作失败：$($Arguments[0])。请检查上方提示，未验证部署成功。" }
  return $result
}
function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
  & git @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'Git 操作失败。未验证部署成功。' }
}
& gh auth status
if ($LASTEXITCODE -ne 0) { throw '请先运行 gh auth login --hostname github.com --git-protocol https --web --scopes workflow 完成授权，再重试本脚本。' }
$login = (Invoke-Gh @('api','user','--jq','.login')).Trim()
Invoke-Gh @('auth','setup-git','--hostname','github.com')
$repo = "$login/$RepositoryName"
$site = Get-Content -LiteralPath 'src/data/site.json' -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not (Test-Path -LiteralPath '.git')) {
  Invoke-Git @('init','-b','main')
  Invoke-Git @('config','user.name',$login)
  Invoke-Git @('config','user.email',"$login@users.noreply.github.com")
}
$changes = Invoke-Git @('status','--porcelain')
if ($changes) {
  Invoke-Git @('add','.')
  Invoke-Git @('commit','-m','升级政视体育V2及免费部署检查')
}
$remotes = @(Invoke-Git @('remote'))
if ('origin' -notin $remotes) {
  for ($candidate=0; $candidate -lt 3; $candidate++) {
    $probe = & gh api "repos/$repo" 2>&1
    $probeCode = $LASTEXITCODE
    if ($probeCode -ne 0) {
      if (($probe | Out-String) -notmatch '404') { throw '无法确认仓库是否存在，请检查网络、API配额或授权。' }
      break
    }
    if ($candidate -eq 2) { throw '目标仓库及替代名称均存在，请用 -RepositoryName 指定新的名称。' }
    $suffix = if ($candidate -eq 0) { 'v2' } else { 'v2-' + (Get-Date -Format 'yyyyMMddHHmmss') }
    $repo = "$login/$RepositoryName-$suffix"
    Write-Host "仓库名称冲突，改用：$repo"
  }
  Invoke-Gh @('repo','create',$repo,'--public','--source','.','--remote','origin','--push','--description','政视体育：洞察体育发展，追踪科技与科研前沿。Astro与GitHub Pages免费静态网站，当前演示阶段。')
} else {
  $origin = Invoke-Git @('remote','get-url','origin')
  if ($origin -notin @("https://github.com/$repo.git","git@github.com:$repo.git","https://github.com/$repo")) { throw '当前 origin 与目标仓库不匹配，已停止。' }
  Invoke-Git @('push','origin','main')
}
$visibility=(Invoke-Gh @('repo','view',$repo,'--json','visibility','--jq','.visibility')).Trim()
if ($visibility -ne 'PUBLIC') { throw '仅允许免费公开仓库部署。' }
& gh api "repos/$repo/pages" --silent 2>$null
if ($LASTEXITCODE -ne 0) { Invoke-Gh @('api',"repos/$repo/pages",'-X','POST','-f','build_type=workflow') | Out-Null }
else { Invoke-Gh @('api',"repos/$repo/pages",'-X','PUT','-f','build_type=workflow') | Out-Null }
$expectedCommit = (Invoke-Git @('rev-parse','HEAD')).Trim()
$dispatchStarted = (Get-Date).ToUniversalTime().AddSeconds(-2)
$dispatched = $false
for ($attempt=0; $attempt -lt 6; $attempt++) {
  & gh workflow run pages.yml --repo $repo --ref main
  if ($LASTEXITCODE -eq 0) { $dispatched = $true; break }
  Start-Sleep -Seconds 5
}
if (-not $dispatched) { throw '手动部署触发失败，请检查仓库Actions是否已启用。' }
Write-Host "已提交部署任务。运行日志：https://github.com/$repo/actions"
$runId = $null
for ($i=0; $i -lt 12; $i++) {
  $runs = (Invoke-Gh @('run','list','--repo',$repo,'--workflow','pages.yml','--event','workflow_dispatch','--limit','10','--json','databaseId,headSha,createdAt') | Out-String) | ConvertFrom-Json
  $matching = $runs | Where-Object { $_.headSha -eq $expectedCommit -and [DateTime]::Parse($_.createdAt).ToUniversalTime() -ge $dispatchStarted } | Select-Object -First 1
  $runId = $matching.databaseId
  if ($runId) { break }
  Start-Sleep -Seconds 5
}
if (-not $runId) { throw '任务编号尚未可见，请在 Actions 中检查。' }
Invoke-Gh @('run','watch',"$runId",'--repo',$repo,'--exit-status','--interval','10')
$pageUrl = (Invoke-Gh @('api',"repos/$repo/pages",'--jq','.html_url')).Trim()
$verified = $false
for ($attempt=1; $attempt -le 3; $attempt++) {
  try {
    $response = Invoke-WebRequest -Uri $pageUrl -TimeoutSec 30 -UseBasicParsing
    $health = Invoke-RestMethod -Uri ($pageUrl.TrimEnd('/') + '/health.json') -TimeoutSec 30
    $marker = 'name="site-id" content="' + $site.siteId + '"'
    if ($response.StatusCode -eq 200 -and $response.Content.Contains('lang="zh-CN"') -and $response.Content.Contains($marker) -and $health.schemaVersion -eq 1 -and $health.siteId -eq $site.siteId -and $health.buildCommit -eq $expectedCommit) { $verified = $true; break }
  } catch { Write-Host "第$attempt 次公开访问检查失败，将重试。" }
  Start-Sleep -Seconds 5
}
if (-not $verified) { throw '公开首页、稳定站点标识或本次提交核验未通过。' }
Write-Host "部署成功，公开网址已验证：$pageUrl"
