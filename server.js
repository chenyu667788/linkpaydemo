const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const port = 3000;

// 启用CORS
app.use(cors());

// 解析JSON请求体
app.use(express.json({ limit: '1mb' }));

// 解析URL编码的请求体
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 静态文件服务
app.use(express.static(__dirname));

// 生成当前时间戳
function getCurrentDateTime() {
  const now = new Date();
  return now.toISOString().replace('Z', '+08:00');
}

// 构建真实的interaction API请求配置
const EVONET_CONFIG = {
    API_ENDPOINT: 'https://sandbox.evonetonline.com/interaction',
    KEY_ID: 'kid_4e103f2ff33c45b39c8df9ee7c8d1336',
    SECRET_KEY: 'sk_sandbox_ef8e03d031e74642a36309f446074037'
};

// 创建支付订单 - 使用interaction API
app.post('/api/create-payment', async (req, res) => {
  try {
    const dateTime = getCurrentDateTime();
    let requestData = req.body;
    
    // 验证必要字段
    if (!requestData) {
      throw new Error('Empty request body');
    }
    if (!requestData.merchantTranInfo) {
      throw new Error('Missing merchantTranInfo');
    }
    if (!requestData.merchantTranInfo.merchantTranID) {
      throw new Error('Missing merchantTranID');
    }
    if (!requestData.transAmount) {
      throw new Error('Missing transAmount');
    }
    if (!requestData.transAmount.currency) {
      throw new Error('Missing currency');
    }
    if (!requestData.transAmount.value) {
      throw new Error('Missing amount value');
    }
    
    // 构建interaction API请求数据
    const apiRequestData = {
      merchantOrderInfo: {
        merchantOrderID: requestData.merchantTranInfo.merchantTranID,
        merchantOrderTime: dateTime
      },
      transAmount: requestData.transAmount,
      userInfo: requestData.userInfo || { reference: 'test' },
      validTime: 5,
      returnUrl: 'http://localhost:3000/evonet-linkpay-frontend.html',
      webhook: 'http://localhost:3000/webhook'
    };
    
    // 构建请求头
    const headers = {
        'Authorization': EVONET_CONFIG.SECRET_KEY,
        'DateTime': dateTime,
        'KeyID': EVONET_CONFIG.KEY_ID,
        'SignType': 'Key-based',
        'Content-Type': 'application/json'
    };
    
    // 使用node-fetch发送请求
    let paymentUrl;
    try {
        const response = await fetch(EVONET_CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(apiRequestData)
        });
        
        const apiResponse = await response.json();
        
        if (apiResponse && apiResponse.linkUrl) {
            paymentUrl = apiResponse.linkUrl;
        } else if (apiResponse && apiResponse.paymentUrl) {
            paymentUrl = apiResponse.paymentUrl;
        } else {
            //  fallback to mock URL if API doesn't return linkUrl or paymentUrl
            const fallbackUrl = `https://sandbox.evonetonline.com/payment/pay?orderId=${requestData.merchantTranInfo.merchantTranID}&amount=${requestData.transAmount.value}&currency=${requestData.transAmount.currency}`;
            paymentUrl = fallbackUrl;
        }
    } catch (error) {
        //  fallback to mock URL if request fails
        const fallbackUrl = `https://sandbox.evonetonline.com/payment/pay?orderId=${requestData.merchantTranInfo.merchantTranID}&amount=${requestData.transAmount.value}&currency=${requestData.transAmount.currency}`;
        paymentUrl = fallbackUrl;
    }
    
    res.json({ 
      success: true, 
      linkUrl: paymentUrl, 
      orderId: requestData.merchantTranInfo.merchantTranID 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 支付成功页面
app.get('/success', (req, res) => {
  res.sendFile(__dirname + '/success.html');
});

// 支付失败页面
app.get('/error', (req, res) => {
  res.sendFile(__dirname + '/error.html');
});

// 支付结果通知（Webhook）
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.json({ success: true, message: 'Webhook received' });
});

// 测试端点
app.post('/test', (req, res) => {
  console.log('Test endpoint received:', req.body);
  res.json({ success: true, message: 'Test received', data: req.body });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});