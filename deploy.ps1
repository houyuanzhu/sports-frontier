param([ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]*$')][string]$RepositoryName = 'public-info-demo')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  $ghInstalled = 'C:/Program Files/GitHub CLI/gh.exe'
  if (Test-Path -LiteralPath $ghInstalled) { $env:PATH = "C:/Program Files/GitHub CLI;$env:PATH" }
  else { throw '请先安装免费 GitHub CLI：winget install --id GitHub.cli --exact，然后重新打开终端。' }
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
if (-not (Test-Path -LiteralPath '.git')) {
  Invoke-Git @('init','-b','main')
  Invoke-Git @('config','user.name',$login)
  Invoke-Git @('config','user.email',"$login@users.noreply.github.com")
  Invoke-Git @('add','.')
  Invoke-Git @('commit','-m','创建中文公共资讯演示站及免费部署流程')
}
$remotes = @(Invoke-Git @('remote'))
if ('origin' -notin $remotes) {
  Invoke-Gh @('repo','create',$repo,'--public','--source','.','--remote','origin','--push','--description','可配置中文公共资讯演示站，Astro 与 GitHub Pages 免费静态部署')
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
Invoke-Gh @('workflow','run','pages.yml','--repo',$repo,'--ref','main')
Write-Host "已提交部署任务。运行日志：https://github.com/$repo/actions"
$runId = $null
for ($i=0; $i -lt 12; $i++) {
  $runId = Invoke-Gh @('run','list','--repo',$repo,'--workflow','pages.yml','--event','workflow_dispatch','--limit','1','--json','databaseId','--jq','.[0].databaseId')
  if ($runId) { break }
  Start-Sleep -Seconds 5
}
if (-not $runId) { throw '任务编号尚未可见，请在 Actions 中检查。' }
Invoke-Gh @('run','watch',"$runId",'--repo',$repo,'--exit-status','--interval','10')
$pageUrl = (Invoke-Gh @('api',"repos/$repo/pages",'--jq','.html_url')).Trim()
$response = Invoke-WebRequest -Uri $pageUrl -TimeoutSec 30
if ($response.StatusCode -ne 200 -or $response.Content -notmatch 'zh-CN' -or $response.Content -notmatch '演示') { throw '公开网页核验未通过。' }
Write-Host "部署成功，公开网址已验证：$pageUrl"
