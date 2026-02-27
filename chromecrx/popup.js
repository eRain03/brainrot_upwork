document.getElementById('grabBtn').addEventListener('click', () => {
  const statusEl = document.getElementById('status');
  const textarea = document.getElementById('cookieResult');
  const btn = document.getElementById('grabBtn');

  statusEl.innerText = "Getting...";
  statusEl.style.color = "#007bff";

  // 1：获取实际发送给 API 主站的 Cookie
  chrome.cookies.getAll({ url: "https://www.eldorado.gg/" }, (cookies) => {
    if (cookies.length === 0) {
      statusEl.innerText = "❌ Not logged in. Please log in to eldorado first.";
      statusEl.style.color = "red";
      return;
    }

    // 2：终极白名单提纯 (只保留这 4 把核心钥匙)
    const whitelist = [
      '__Host-EldoradoIdToken',
      '__Host-XSRF-TOKEN',
      'x-session-id',
      'pseudoId'
    ];

    const cleanCookies = cookies.filter(c => whitelist.includes(c.name));

    // 3：安全校验，看看有没有提取到最重要的身份令牌
    const hasIdToken = cleanCookies.some(c => c.name === '__Host-EldoradoIdToken');
    if (!hasIdToken) {
      statusEl.innerText = "❌ Extraction failed: No core identity token detected. Please log in again on the webpage!";
      statusEl.style.color = "red";
      return;
    }

    // 4：拼装成标准的请求头格式 (name=value; name2=value2;)
    const cookieString = cleanCookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    // 显示在输入框里
    textarea.style.display = "block";
    textarea.value = cookieString;
    
    // 自动复制到剪贴板
    navigator.clipboard.writeText(cookieString).then(() => {
      statusEl.innerText = "✅ Purification successful! Data extracted and copied.";
      statusEl.style.color = "green";
      btn.innerText = "重新提取";
    }).catch(err => {
      statusEl.innerText = "⚠️ Purification successful, but automatic copying failed. Please manually copy the text below.";
      statusEl.style.color = "orange";
    });
  });
});
