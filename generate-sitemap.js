const fs = require('fs');
const path = require('path');

// 配置
const config = {
    baseUrl: 'https://nemotron3nano.com',
    extensions: ['.html', '.htm'], // 要扫描的文件扩展名
    excludeDirs: ['node_modules', '.git', '.claude'], // 排除的目录
    excludeFiles: ['server.js', 'generate-sitemap.js', 'package-lock.json'], // 排除的文件
    output: 'sitemap.xml',
    changefreq: 'weekly',
    priority: '1.0'
};

// 递归扫描目录获取所有 HTML 文件
function scanDirectory(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');

        // 跳过排除的目录
        if (config.excludeDirs.some(excluded => relativePath.includes(excluded))) {
            return;
        }

        // 跳过排除的文件
        if (config.excludeFiles.some(excluded => relativePath.endsWith(excluded))) {
            return;
        }

        if (stat.isDirectory()) {
            scanDirectory(filePath, fileList);
        } else if (stat.isFile()) {
            const ext = path.extname(file);
            if (config.extensions.includes(ext)) {
                fileList.push(relativePath);
            }
        }
    });

    return fileList;
}

// 从 HTML 文件中提取锚点链接
function extractAnchors(htmlContent) {
    const anchors = new Set();

    // 只提取 section 标签的 id（真正的页面章节）
    const sectionRegex = /<section[^>]*\sid=["']([^"']+)["']/gi;
    let match;
    while ((match = sectionRegex.exec(htmlContent)) !== null) {
        const id = match[1];
        if (id) {
            anchors.add(id);
        }
    }

    // 也提取导航链接中的锚点
    const navRegex = /<a[^>]*href=["']#([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    while ((match = navRegex.exec(htmlContent)) !== null) {
        const anchor = match[1];
        if (anchor && !anchor.includes('http')) {
            anchors.add(anchor);
        }
    }

    // 过滤掉表单元素和功能性 id
    const filtered = Array.from(anchors).filter(id =>
        !id.startsWith('prompt') &&
        !id.startsWith('aspect') &&
        !id.startsWith('output') &&
        !id.includes('Button') &&
        !id.includes('Btn') &&
        !id.includes('Area') &&
        !id.match(/^\d+$/)
    );

    return filtered;
}

// 获取文件修改时间
function getLastModTime(filePath) {
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString().split('T')[0];
}

// 生成 sitemap XML
function generateSitemap() {
    const urls = [];
    const today = new Date().toISOString().split('T')[0];

    // 添加首页
    urls.push({
        loc: config.baseUrl + '/',
        lastmod: today,
        changefreq: 'daily',
        priority: '1.0'
    });

    // 自动扫描所有 HTML 文件
    const htmlFiles = scanDirectory(__dirname);
    console.log(`🔍 扫描到 ${htmlFiles.length} 个 HTML 文件\n`);

    htmlFiles.forEach(file => {
        const filePath = path.join(__dirname, file);

        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  文件不存在: ${file}`);
            return;
        }

        const htmlContent = fs.readFileSync(filePath, 'utf-8');
        const anchors = extractAnchors(htmlContent);
        const lastmod = getLastModTime(filePath);

        console.log(`📄 ${file}: 找到 ${anchors.length} 个锚点`);

        // 添加文件本身
        urls.push({
            loc: `${config.baseUrl}/${file}`,
            lastmod: lastmod,
            changefreq: config.changefreq,
            priority: '0.9'
        });

        // 添加带锚点的 URL
        anchors.forEach(anchor => {
            urls.push({
                loc: `${config.baseUrl}/${file}#${anchor}`,
                lastmod: lastmod,
                changefreq: config.changefreq,
                priority: '0.8'
            });
        });
    });

    // 生成 XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n';

    urls.forEach(url => {
        xml += '  <url>\n';
        xml += `    <loc>${url.loc}</loc>\n`;
        xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
        xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
        xml += `    <priority>${url.priority}</priority>\n`;
        xml += '  </url>\n\n';
    });

    xml += '</urlset>';

    // 写入文件
    fs.writeFileSync(path.join(__dirname, config.output), xml, 'utf-8');
    console.log(`\n✅ Sitemap 已生成: ${config.output}`);
    console.log(`📊 共 ${urls.length} 个 URL`);
}

// 运行
generateSitemap();
