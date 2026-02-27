/*
 * 文件名: test_cookie_direct.js
 * 作用简述: 
 * 1. 纯 Cookie 驱动：无需配置账号密码，直接使用写死在代码里的原生浏览器 Cookie 进行测试。
 * 2. 自动提取防跨站攻击的 XSRF Token。
 * 3. 执行完整的：图片上传 -> 嗅探 Env ID -> 上架 -> 下架 闭环测试。
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const _eldorado_hostname = 'www.eldorado.gg';  

// ⬇️ 你提供的原生 Cookie 已经写死在这里了 
// (注：开头的 "Cookie" 已经被我修剪掉，确保格式合法)
const HARDCODED_COOKIE = "pseudoId=2a51d684-8657-4459-9763-afe73c773c6f; __Host-XSRF-TOKEN=249fdb656712089a064e667495ce0f24f5cb680e4d164712fbacb37150cc6e16; eldoradogg_locale=en-US; eldoradogg_currencyPreference=USD; _scid=ZRdrmzefqa4PAeSX8rnQ_GIsJx-UlHzE; _gcl_au=1.1.603545370.1770881778; _ga_NMQG6CG3T7=GS2.1.s1772171533$o11$g1$t1772175379$j60$l0$h104917753; _ga=GA1.1.234683762.1770881778; _ga_5FTLBY1CZ4=GS2.1.s1772171533$o15$g1$t1772175379$j60$l0$h0; rtkclickid-store=698d82f2d6abdf660c86fd8f; _tt_enable_cookie=1; _ttp=01KH8CF1K699GZD22GS13GZ5X8_.tt.1; ttcsid_CQH0ENRC77U09334C3G0=1772171538366::Z60O5219thuue2Pc1Bbl.11.1772175396794.1; ttcsid=1772171538367::unyE8RIsn8AnoURUyGDE.11.1772175396795.0::1.3858984.3843597::3858362.33.140.295::2146079.15.0; _fbp=fb.1.1770881779367.172818167172217996; _hjSessionUser_5163483=eyJpZCI6Ijk0YjM2Y2U1LWMxYWItNTVmNy05ZDk1LWRlMDAzNjE3YjA5MCIsImNyZWF0ZWQiOjE3NzA4ODE3Nzk2NDEsImV4aXN0aW5nIjp0cnVlfQ==; _clck=1mdweld%5E2%5Eg3x%5E0%5E2234; _sctr=1%7C1772121600000; intercom-id-mipk5r3a=bb473eaf-62c4-4505-85f5-5d5544280427; intercom-session-mipk5r3a=T1IrUEt6eWsrY2tBTFk5Nzc1SXBselNNVXJTVkdxK0dqM1J0RXFmUWZmckZrMkNrampJaVJIZ2tCbEJRWVRhVmhtTEJkK0tFcHRkVVp4SUkwOXhteU82cDhXNGlDMi81S1hHd2ttUUF3RUlVbHgzbk1JU2ZBZURJTG5YSzd3aUN0ZnZCdUVCNTJ6bG9xMEtjT0t5c2tZVi84ZEtPcm93NFdPOWduT01aNS9pNWpENkduU080ZTJKVThJVFo2SlRMQWtMMHA5aW5sZ3dFQXprZmp1dGRCdz09LS04Tk8xSlFOK0lFVXE2UGhXU3hQdW5BPT0=--0ba17b5264dcff68d98514f00c17833208012ce6; intercom-device-id-mipk5r3a=6e6235c7-6d0a-44ce-a034-21b4e6fcfd33; x-session-id=d55daf7b-3ffc-4aea-9280-0e491440ad90; cf_clearance=kZ_NRmBj_8hw15_kwHHb62gUIFIMXJYOLyQwO5CJ.X8-1772172172-1.2.1.1-h8y0Kk.fdp5VY342biu_6ADQXOrOA0tOeqeXH9pYQ1JH2MHnx4Q2L0TLjn03_IcGQS695elKbJ2iO.8huuzuHA0zd7AVMzkW6hhcsoRCOXcZ3ASqTatNlfTYjK88yVuIcTupTeZiSb1_0DG0zVf0bQ8WRkhme1Z0_rVH8H9c1iX1p6BoDD9EI0NbrOj4CYKjhg2EcLWtFsl9OsRQyvxr3dRs2ZXYVdl.gvhwt1zOBk8; cr-homepage-usp=0; p-checkout-test=0; cr-offer-sorting-v2=1; p-guest-checkout=0; cr-currency-aa=1; cr-homepage-aa=1; cr-top-up-aa=1; p-primer-update=1; curr-homepage-trending-games=0; ac-score-p-g=1; cr-smaller-other-sellers-list=1; or-non-instant-redesign=1; cr-top-up-swipeable=0; ac-nas-forms=1; ac-nas-offer=1; ac-nas-cards=1; ac-nas-filters=1; it-product-aa=0; it-offer-listing-aa=1; p-billing-descriptor=1; it-abc=1; ac-gs-game-f=0; ac-trust-in-v1=1; ac-gs-aa=1; ac-offer-listing-aa=1; ac-offer-p-aa=1; ac-price-mb=1; cr-top-up-seller-reviews=0; it-mgmt=1; it-predefined-sab=0; it-popular-items=0; it-roblox-vp=1; cr-homepage-banner-refresh=1; _hjSession_5163483=eyJpZCI6IjU4ZWJhYWFjLTQ2N2ItNDljYi04ZjllLWYyNDdiZjkyYjIwNCIsImMiOjE3NzIxNzE1MTg1MjksInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _hjHasCachedUserAttributes=true; __Host-EldoradoIdToken=eyJraWQiOiJETTJSdklPTldaZThEd01ZNDNlbHZDTE9mbmZVNFozcWljOFQ4bmhTbmFBPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiSE5jOFFqTWVBVkxtSm56blQ1ZlhEQSIsInN1YiI6IjcxYmMxNjYyLTNlZTMtNDAwYS1iYzU1LWQ3MTQwZWE4YjA1ZCIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMl9NbG56Q0ZnSGtfR29vZ2xlIl0sImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAudXMtZWFzdC0yLmFtYXpvbmF3cy5jb21cL3VzLWVhc3QtMl9NbG56Q0ZnSGsiLCJjb2duaXRvOnVzZXJuYW1lIjoiZ29vZ2xlXzExNTYxNTkzMDY0MzMzMTQ5NzIzMCIsImN1c3RvbTp1c2VyaWRfb3ZlcnJpZGUiOiI3MWJjMTY2Mi0zZWUzLTQwMGEtYmM1NS1kNzE0MGVhOGIwNWQiLCJ1c2VySWQiOiI3MWJjMTY2Mi0zZWUzLTQwMGEtYmM1NS1kNzE0MGVhOGIwNWQiLCJvcmlnaW5fanRpIjoiZjVmNTAwOGUtZGQ1NC00OWJlLWExMmQtYmNlMDViZDdiODQyIiwiYXVkIjoiM2E0aGFsNmpnbDhnZjVobm5qbzA2azA1czUiLCJpZGVudGl0aWVzIjpbeyJ1c2VySWQiOiIxMTU2MTU5MzA2NDMzMzE0OTcyMzAiLCJwcm92aWRlck5hbWUiOiJHb29nbGUiLCJwcm92aWRlclR5cGUiOiJHb29nbGUiLCJpc3N1ZXIiOm51bGwsInByaW1hcnkiOiJ0cnVlIiwiZGF0ZUNyZWF0ZWQiOiIxNzcwODg0NTcxNjY0In1dLCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTc3MjE3MjcwNywiZXhwIjoxNzcyMTc2Mzk3LCJpYXQiOjE3NzIxNzQ1OTcsImp0aSI6ImE4OGM3Y2JkLWRmZGMtNGQxZC1hY2M0LWYzM2QxNTg4NmMwMyIsImVtYWlsIjoiZnVueS5oYW90aWFuQGdtYWlsLmNvbSJ9.WYQmJ96OgelC4Feyeic1V9xPPLI42hrW7RN6j0ImmWTNv9Rjho9VS6Q7ZIv0V_KYaUlMf2cEyC2hYX6ECrWjeutD4RPTTLb801UAypVBfmMoBbLesHyBURcQCleQNjMYzh0TmM4s3qfdBjoXTqJ7lVUxarvVHLTun_VXhCV6PSml-5KJHBwiXzjH_8Y5mDDax4wLGGKhCdIh_rYwmDPCJ1Z36RWlxvBmkoymNLIuv3GgsJjnOYlPNCCaTBxAG7WSz4XXtUs1zopYb1vdrH0UOtbqCnsmaLqV-VcfRomB6APMALLbrDPExKo11iKvPFCY7AnDmB9xT_hIdBcTOfG8rA; __Host-EldoradoRefreshToken=eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.pr0iULAqu3i8UiS1Gy0RqZ9EQ3gpgwZR_jLBP5vZ2tsjzDdbjX0XMWl3Q77EE6hjyLsIriLthL3fDOzAgUgcLm6J7gBYy2wpKoGa72TyCx6Tsq9xcCDaJnhr3Mu-MDKDdi5vtaJ0ioLpBDNyknTRj7JEy2C5OxfVUQSKCAUzEfT8__t85awFNRWmbyLhkBLXOJ8ydvBohjO4w0e6vTUVSmPMfi2r5VlEIFTm25znIygupdjrNF_5b6oU3SGjjfgzUEf1rzZ0x50EljZ_xe6gXmemUMJShFWehi-DMgTAAzK4wRsFs4dltqkskNlhN9jPRl374jdLJfpwesQaf5D2qA.yfD88HZ0CRKWEm7h.WwEQmnKE4xdrE38I7l7Sz7Q6U7ukIrpXJ1fTnAOFYXAx8QeKFNX4HJ4quvyeHTqdqLSSN5u_a_MMHD_-rjZ6Jvmze3McPFfVVPbTg21dtGa6rtmBC8hyuGeUt9iR8_i5PcWm2fCvHgTZxVs4ePJICI6NDTSb5-1iQZnBnONjQWHPUJqHR_TNGu-mnqxGL_3SWM-DheEMdLxg__CZ_FGnjJV685Q56m2H570EPA_W7yPceuant6SM5iSi7MkTFCd90oS5msEEpO5wanD4wMouTU0LeKDLbsM_gWHBVc6xj-0tUmWbnj3a4BJ4TmmOPuij2waE_7ayd-L2xwe9G3FYg9WfP5bcX-ROVlFnkh2HTgYLgjhjsLbPRHCIZaxENjAjmYczFnhrHwGHeKRK-1cxx6zezUA_4CMj0k9f56ZjYsW2EvHANIIvJKVW5QFQvCc9TgY4UXhQv7KRhmg2UcJq-EXmo_IDj7gFFCGxxWrfeyKIjEiPr7y89aSZxiowtluyormGFor1k3-fdXclTsLdrsVqHgYZSRNgwV8mEJrPFmA9KzOEzmYLsM5d5-cN8fxH8Rl9J75_QfHAIyWHwkdTWnlAigPawC_QNkenUuTL9FLeizg_PM7FvS54t6tgUtQ1oN-yzXY-34TG6jXJvuOclSW8Hfp3isK4xwW0UleyrYqUdzXdF7M2_efKJ8_I9_z41z2bt9aH_K-IecZoyjDB8NtSBtyAP32pXmZpkH2Ns9Au1N1vGHVaGMr55T6GECbgemyiKXDtEbXzFa7SuyIglSJZt92NLhg4TGFqdsZftZ89sVQzKY_XxlVyEM6LL7tt5vwRXyWZpnQblpf3435Rl4Q_tPlRedWjGI3-3bbC8aOWdrxluBHo06x2fP0FrHfDPYcGPWFIP1QJhhgMdKNTYYDeOO5Py9dlbOwm2W96uUsbCxmLQLC3zWNSfTo-bDpX3n0YtWVJBTbej-rcvyjSBU9ex8datuR__qys0xrhcEHj67zNqB8-5-Yn9yAOWGWkQ8YonMNaWXKNQ8Hav7-9xPMTVyqnlagOjz2QIjdPkAu6SNxeSTR9SX4u3ytD9ZnGxaWafiD6IPjFfwKTrMX5iSdzUtXuzBYKDyD_Vuk5TKiXsONGEE2U4OqhU9tm85PQgH31KsuZWFTXvK_T99oz2XlDFENWEBPOtK32Npm7ahsbGM0uQtTi05KvycOIZb3jJUJGazyDkyDp1pi1OTFDfUYuhlumIWCrEItw5FBzVXjp_LjSx3S4dp_K_kG1T5wpHUkMRRbpBBEmjA.7sS37s6ni-Vs9QhPY1K-uw; _scid_r=epdrmzefqa4PAeSX8rnQ_GIsJx-UlHzEvaHtZA; _clsk=1b5otnh%5E1772175385630%5E1%5E0%5En.clarity.ms%2Fcollect; _uetsid=77bc0c7013a011f18f400766c7275ca0; _uetvid=85589dd007e511f18166dfe446ab3f0f"

// ================= 辅助函数 =================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 智能提取 XSRF Token
 */
function extractXsrfToken(cookieString) {
  const match = cookieString.match(/__Host-XSRF-TOKEN=([^;]+)/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------
// 核心请求封装
// ---------------------------------------------------------
function makeApiRequest(method, pathStr, cookieString, xsrfToken, payload = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Accept': 'application/json',
      'Cookie': cookieString,
      'swagger': 'Swager request'
    };

    // 自动挂载 XSRF 防火墙令牌
    if (xsrfToken && (method === 'POST' || method === 'DELETE' || method === 'PUT')) {
      headers['X-XSRF-Token'] = xsrfToken;
    }

    const options = {
      hostname: _eldorado_hostname,
      path: pathStr,
      method: method,
      headers: headers
    };

    let bodyString = '';
    if (payload) {
      bodyString = JSON.stringify(payload);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = https.request(options, (res) => {
      res.setEncoding('utf8'); 
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (!responseBody) return resolve({}); 
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve(responseBody);
          }
        } else {
          reject(new Error(`[${method}] ${pathStr} 失败. 状态码: ${res.statusCode}, 响应: ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(bodyString);
    req.end();
  });
}

/**
 * 图片上传函数
 */
async function uploadImageToEldorado(imagePath, cookieString, xsrfToken) {
  const uploadUrl = `https://${_eldorado_hostname}/api/files/me/Offer`;
  
  if (!fs.existsSync(imagePath)) {
    throw new Error(`找不到图片文件: ${imagePath}。请确保目录下有一张 test.png`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const fileName = path.basename(imagePath);
  
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/png' }); 
  formData.append('image', blob, fileName); 

  console.log(`[POST] 正在上传图片 ${fileName} 到 Eldorado CDN...`);

  const headers = {
    'Cookie': cookieString,
    'swagger': 'Swager request'
  };
  
  if (xsrfToken) {
    headers['X-XSRF-Token'] = xsrfToken;
  }

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    const responseText = await response.text();

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ 图片上传成功！原始 CDN 返回数据:');
      
      if (result.localPaths && Array.isArray(result.localPaths)) {
        const extractFileName = (fullPath) => fullPath.split('/').pop();
        const smallImg = result.localPaths.find(p => p.includes('Small')) || result.localPaths[0];
        const largeImg = result.localPaths.find(p => p.includes('Large')) || result.localPaths[1];
        const originalImg = result.localPaths.find(p => p.includes('Original')) || result.localPaths[2];

        return {
          smallImage: extractFileName(smallImg),
          largeImage: extractFileName(largeImg),
          originalSizeImage: extractFileName(originalImg)
        };
      }
      return Array.isArray(result) ? result[0] : result; 
    } else {
      throw new Error(`HTTP ${response.status} - ${responseText}`);
    }
  } catch (error) {
    console.error('❌ 图片上传发生错误:', error.message);
    return null;
  }
}

// ================= 主逻辑 =================

async function main() {
  console.log('🚀 正在使用代码中写死的原生 Cookie 模式启动...');
  
  const cookieString = HARDCODED_COOKIE;
  const xsrfToken = extractXsrfToken(cookieString);
  
  if (xsrfToken) {
    console.log('✅ 成功从 Cookie 中提取并装载 XSRF 防火墙令牌');
  } else {
    console.log('⚠️ 未能在 Cookie 中找到 __Host-XSRF-TOKEN，提交可能会失败。');
  }

  // ---------------------------------------------------------
  // 步骤 1: 上传图片并转换数据格式
  // ---------------------------------------------------------
  const testImagePath = path.join(__dirname, 'test.png');
  const myUploadedImageObject = await uploadImageToEldorado(testImagePath, cookieString, xsrfToken);

  if (!myUploadedImageObject || !myUploadedImageObject.smallImage) {
    console.error("❌ 图片上传失败，程序终止。提示: 如果报 401，请检查 Cookie 字符串是否被截断(...)或缺少认证 Token。");
    process.exit(1);
  }

  // ---------------------------------------------------------
  // 步骤 2: 仅嗅探 Env ID
  // ---------------------------------------------------------
  console.log(`\n[GET] 正在嗅探 Roblox 的 CustomItem Env ID...`);
  const searchPath = '/api/flexibleOffers?gameId=70&category=CustomItem&pageSize=20';
  let tradeEnvId = null;

  try {
    const searchResponse = await makeApiRequest('GET', searchPath, cookieString, xsrfToken);
    if (searchResponse.results && searchResponse.results.length > 0) {
      for (const item of searchResponse.results) {
        const offerData = item.offer || item;
        if (offerData.tradeEnvironmentValues && offerData.tradeEnvironmentValues.length > 0) {
          tradeEnvId = offerData.tradeEnvironmentValues[0].id;
          break; 
        }
      }
    }
  } catch (err) {}

  if (!tradeEnvId) {
    console.error("❌ 无法获取 Environment ID，程序终止。");
    process.exit(1);
  }
  console.log(`✅ 成功拿到 Env ID: ${tradeEnvId}`);

  // ---------------------------------------------------------
  // 步骤 3: 构造 Payload 并上架
  // ---------------------------------------------------------
  const createPath = '/api/flexibleOffers/item';
  const offerPayload = {
    details: {
      offerTitle: "[TESTING ONLY] Native Cookie Upload Test", 
      description: "Testing API with Native Browser Cookie.",
      guaranteedDeliveryTime: "Day1", 
      mainOfferImage: myUploadedImageObject, 
      pricing: {
        quantity: 1,
        minQuantity: 1,
        pricePerUnit: { amount: 10000.00, currency: "USD" }
      }
    },
    augmentedGame: {
      gameId: "70", 
      category: "CustomItem",
      tradeEnvironmentId: tradeEnvId 
    }
  };

  let createdOfferId = null;

  try {
    console.log(`\n[POST] 正在执行上架操作...`);
    const createResponse = await makeApiRequest('POST', createPath, cookieString, xsrfToken, offerPayload);
    createdOfferId = createResponse.id;
    console.log(`✅ 上架成功！你自己的图片已发布，商品 ID: ${createdOfferId}`);
  } catch (error) {
    console.error(`❌ 上架失败: ${error.message}`);
    process.exit(1); 
  }

  // ---------------------------------------------------------
  // 步骤 4: 自动下架
  // ---------------------------------------------------------
  console.log(`\n⏳ 等待 3 秒钟后下架...`);
  await sleep(3000); 

  if (!createdOfferId) process.exit(1);

  try {
    console.log(`[DELETE] 正在彻底下架商品 ID: ${createdOfferId} ...`);
    await makeApiRequest('DELETE', `/api/flexibleOffersUser/me/${createdOfferId}`, cookieString, xsrfToken);
    console.log(`✅ 下架成功！Cookie 模式测试闭环圆满完成 🚀🚀🚀`);
  } catch (error) {
    console.error(`❌ 下架失败: ${error.message}`);
  }
}

main();
