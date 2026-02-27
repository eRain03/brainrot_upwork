document.getElementById('grabBtn').addEventListener('click', () => {
  const statusEl = document.getElementById('status');
  const textarea = document.getElementById('cookieResult');
  const btn = document.getElementById('grabBtn');

  statusEl.innerText = "⏳ 正在提取并进行白名单提纯...";
  statusEl.style.color = "#007bff";

  // 1：获取实际发送给 API 主站的 Cookie
  chrome.cookies.getAll({ url: "https://www.eldorado.gg/" }, (cookies) => {
    if (cookies.length === 0) {
      statusEl.innerText = "❌ 提取失败：未找到登录状态，请先登录！";
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
      statusEl.innerText = "❌ 提取失败：未检测到核心身份 Token，请在网页重新登录！";
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
      statusEl.innerText = "✅ 提纯成功！已提取 4 项核心数据并复制";
      statusEl.style.color = "green";
      btn.innerText = "重新提取";
    }).catch(err => {
      statusEl.innerText = "⚠️ 提纯成功，但自动复制失败，请手动复制下方文本。";
      statusEl.style.color = "orange";
    });
  });
});
