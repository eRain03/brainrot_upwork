# 目标端口范围
$ports = 6671..6675
# 递归获取当前目录下所有 .vue 文件
$files = Get-ChildItem -Path . -Filter *.vue -Recurse

foreach ($file in $files) {
    # 使用 .NET 底层方法读取，确保 UTF-8 编码不丢失且不乱加 BOM 头
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content

    foreach ($port in $ports) {
        $search = "http://localhost:$port"
        $replace = "https://$port.eldoai.shop"
        $content = $content.Replace($search, $replace)
    }

    # 如果内容有变动则写入并打印日志
    if ($content -cne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Update: $($file.FullName)" -ForegroundColor Green
    }
}

Write-Host "Done。" -ForegroundColor Cyan
