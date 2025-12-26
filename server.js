const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname)));

// 生成图片接口
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, aspect_ratio, output_format, output_quality } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: '请提供提示词' });
        }

        const apiKey = process.env.REPLICATE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: '服务器配置错误：未找到 API Key' });
        }

        // 调用 Replicate API
        const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait'
            },
            body: JSON.stringify({
                input: {
                    prompt: prompt,
                    go_fast: true,
                    megapixels: "1",
                    num_outputs: 1,
                    aspect_ratio: aspect_ratio || "1:1",
                    output_format: output_format || "webp",
                    output_quality: output_quality || 80,
                    num_inference_steps: 4
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ error: errorData.detail || 'API 请求失败' });
        }

        const prediction = await response.json();

        // 如果还在处理中，轮询结果
        let result = prediction;
        if (prediction.status === 'starting' || prediction.status === 'processing') {
            result = await pollPrediction(prediction.id);
        }

        if (result.status === 'succeeded') {
            const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
            res.json({ url: imageUrl });
        } else if (result.status === 'failed') {
            res.status(500).json({ error: result.error || '生成失败' });
        } else {
            res.status(500).json({ error: '生成超时' });
        }

    } catch (error) {
        console.error('生成图片错误:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 轮询预测状态
async function pollPrediction(predictionId) {
    const apiKey = process.env.REPLICATE_API_KEY;
    const maxAttempts = 120;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        const prediction = await response.json();

        if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
            return prediction;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }

    throw new Error('请求超时');
}

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Nano Banana API is running' });
});

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'nano-banana-landing-page.html'));
});

app.listen(PORT, () => {
    console.log(`🍌 Nano Banana API Server 运行在 http://localhost:${PORT}`);
    console.log(`📄 打开浏览器访问 http://localhost:${PORT}`);
});
