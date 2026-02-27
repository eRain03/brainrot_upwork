// index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Amplify } = require('aws-amplify');
const { signIn, signOut, fetchAuthSession } = require('aws-amplify/auth');

// Initialize Express app
const app = express();
const port = process.env.PORT || 6675;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure Multer for file uploads
const upload = multer({ dest: '/tmp/uploads/' });

// ================= Configure AWS Amplify =================
const _pool_id = 'us-east-2_MlnzCFgHk';
const _client_id = '1956req5ro9drdtbf5i6kis4la';
const _cognito_hostname = 'https://login.eldorado.gg';
const _eldorado_hostname = 'www.eldorado.gg';

Amplify.configure({
    Auth: {
        Cognito: {
            userPoolId: _pool_id,
            userPoolClientId: _client_id,
            loginWith: {
                oauth: {
                    domain: _cognito_hostname.replace('https://', ''),
                    redirectSignIn: `https://${_eldorado_hostname}/account/auth-callback`,
                    responseType: "code",
                },
            },
        },
    },
});

// ================= Dictionaries =================
// You can expand this if you need mapping, but based on your instructions, 
// if frontend passes the ID, we might not strictly need it for envId. 
// However, I've noticed the M/s and Mutations might need string mapping.
// Looking at your latest payload, M/s and Mutations are passed as strings:
// "steal-a-brainrot-ms": "1-plus-bs"
// "steal-a-brainrot-mutations": "lava"

const msMapping = {
    "0": "0",
    "0-24 M/s": "0-24-ms",
    "25-49 M/s": "25-49-ms",
    "50-99 M/s": "50-99-ms",
    "100-249 M/s": "100-249-ms",
    "250-499 M/s": "250-499-ms",
    "500-749 M/s": "500-749-ms",
    "750-999 M/s": "750-999-ms",
    "1+ B/s": "1-plus-bs"
};

// ================= Helper Functions =================

function extractXsrfToken(cookieString) {
  const match = cookieString.match(/__Host-XSRF-TOKEN=([^;]+)/);
  return match ? match[1].trim() : null;
}

async function authenticate(username, password) {
    try {
        try {
            await signOut();
        } catch (e) {
            // Ignore sign out errors if not signed in
        }
        
        const signInOutput = await signIn({ username, password });
        if (signInOutput.nextStep.signInStep !== 'DONE') {
            throw new Error(`Sign-in not complete. Next step: ${signInOutput.nextStep.signInStep}`);
        }
        const session = await fetchAuthSession();
        if (!session.tokens || !session.tokens.idToken) {
            throw new Error('No ID token found in session.');
        }
        return session.tokens.idToken.toString();
    } catch (error) {
        console.error('Error during authentication:', error);
        throw error;
    }
}

async function uploadImageToEldorado(imagePath, fileName, authData) {
    const uploadUrl = `https://${_eldorado_hostname}/api/files/me/Offer`;

    if (!fs.existsSync(imagePath)) {
        throw new Error(`找不到图片文件: ${imagePath}`);
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('image', blob, fileName);

    console.log(`[POST] 正在上传图片 ${fileName} 到 Eldorado CDN...`);

    const headers = {
        'swagger': 'Swager request'
    };

    if (authData.cookieStr) {
        headers['Cookie'] = authData.cookieStr;
        if (authData.xsrfToken) headers['X-XSRF-Token'] = authData.xsrfToken;
    } else if (authData.idToken) {
        headers['Cookie'] = `__Host-EldoradoIdToken=${authData.idToken}`;
    }

    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: formData
    });

    const responseText = await response.text();

    if (response.ok) {
        const result = JSON.parse(responseText);
        
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
}

async function createOffer(payload, authData) {
    const createPath = '/api/flexibleOffers/item';
    const url = `https://${_eldorado_hostname}${createPath}`;

    console.log(`[POST] 正在执行上架操作...`);
    
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'swagger': 'Swager request'
    };

    if (authData.cookieStr) {
        headers['Cookie'] = authData.cookieStr;
        if (authData.xsrfToken) headers['X-XSRF-Token'] = authData.xsrfToken;
    } else if (authData.idToken) {
        headers['Cookie'] = `__Host-EldoradoIdToken=${authData.idToken}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (response.ok) {
        return responseText ? JSON.parse(responseText) : {};
    } else {
        throw new Error(`[POST] ${createPath} 失败. 状态码: ${response.status}, 响应: ${responseText}`);
    }
}


// ================= API Endpoints =================

app.post('/api/create-offer', upload.single('image'), async (req, res) => {
    console.log('--- 收到新的上架请求 ---');
    
    // 1. 获取输入参数
    const { 
        authMode,
        cookieStr,
        email, 
        password, 
        title, 
        description, 
        price, 
        tradeEnvironmentId, 
        msRate, 
        mutations 
    } = req.body;
    
    const file = req.file;

    // 基本校验
    if (!title || !price || !tradeEnvironmentId || !file) {
        return res.status(400).json({ success: false, message: '缺少必要的参数，请检查(title, price, tradeEnvironmentId, image均必填)。' });
    }
    if (authMode === 'cookie' && !cookieStr) {
        return res.status(400).json({ success: false, message: 'Cookie 模式下缺少 Cookie。' });
    }
    if ((!authMode || authMode === 'email') && (!email || !password)) {
        return res.status(400).json({ success: false, message: '邮箱密码模式下缺少账号密码。' });
    }

    try {
        let authData = {};
        if (authMode === 'cookie') {
            console.log(`[1/4] 使用 Cookie 模式验证...`);
            authData.cookieStr = cookieStr.replace(/\r?\n|\r/g, '').trim();
            authData.xsrfToken = extractXsrfToken(authData.cookieStr);
            console.log(`[1/4] ✅ Cookie 解析完成`);
        } else {
            // 2. AWS 身份验证
            console.log(`[1/4] 正在验证账号: ${email}...`);
            const idToken = await authenticate(email, password);
            authData.idToken = idToken;
            console.log(`[1/4] ✅ 账号验证成功`);
        }

        // 3. 上传图片
        console.log(`[2/4] 正在上传图片...`);
        const formattedImageObject = await uploadImageToEldorado(file.path, file.originalname, authData);
        if (!formattedImageObject || !formattedImageObject.smallImage) {
            throw new Error("图片上传失败或返回格式无法解析");
        }
        console.log(`[2/4] ✅ 图片上传成功`);

        // 4. 数据转换与整理
        console.log(`[3/4] 正在组装 Payload...`);
        
        // 处理 M/s 格式转换 (如果没有匹配到字典，回退到默认或者传过来的原值的小写连字符格式)
        let formattedMs = msMapping[msRate];
        if(!formattedMs && msRate) {
            // e.g., "150 M/s" -> "150-ms" (Fallback logic just in case)
            formattedMs = msRate.toLowerCase().replace(/ \//g, '-').replace(/\//g, '-').replace(/ /g, '-');
        }

        // 处理 Mutations (小写即可，如 "Lava" -> "lava")
        const formattedMutations = mutations ? mutations.toLowerCase() : "";

        // 构建 Payload
        const offerPayload = {
            details: {
                pricing: {
                    quantity: 1,
                    pricePerUnit: { 
                        amount: parseFloat(price), 
                        currency: "USD" 
                    },
                    volumeDiscounts: []
                },
                mainOfferImage: formattedImageObject,
                offerImages: [],
                offerTitle: title,
                description: description || null,
                guaranteedDeliveryTime: "Day7" // 默认 Day7，如有需要可让前端传入
            },
            augmentedGame: {
                gameId: "259", // 固定
                category: "CustomItem", // 固定
                tradeEnvironmentId: tradeEnvironmentId, // 前端直接传入字典中对应的值 (例如 "0-7-3")
                attributes: {
                    "steal-a-brainrot-ms": formattedMs || "0", 
                    "steal-a-brainrot-mutations": formattedMutations || "none"
                },
                attributeIdsCsv: null
            }
        };

        // 5. 发送上架请求
        console.log(`[4/4] 正在提交上架数据...`);
        const createResponse = await createOffer(offerPayload, authData);
        const createdOfferId = createResponse.id;
        console.log(`[4/4] ✅ 上架成功！商品 ID: ${createdOfferId}`);

        // 6. 清理临时文件 & 返回成功
        fs.unlink(file.path, (err) => {
            if (err) console.error("清理临时图片失败:", err);
        });

        res.json({
            success: true,
            message: '上架成功',
            id: createdOfferId,
            url: `https://www.eldorado.gg/steal-a-brainrot-brainrots/oi/${createdOfferId}`
        });

    } catch (error) {
        console.error('❌ 处理请求时发生错误:', error.message);
        
        // 清理临时文件
        if (file && fs.existsSync(file.path)) {
            fs.unlink(file.path, () => {});
        }

        res.status(500).json({
            success: false,
            message: '上架失败: ' + error.message
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`API Endpoint: POST http://localhost:${port}/api/create-offer`);
});
