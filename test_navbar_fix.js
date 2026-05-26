const fs = require('fs');
const path = require('path');

/**
 * 单元测试：验证导航栏修复
 * 测试项：
 * 1. 所有页面导航栏链接一致
 * 2. 导航栏CSS设置了固定字体
 * 3. 没有CSS语法错误（important!）
 */

const PAGES = ['index.html', 'github.html', 'community.html', 'explore.html', 'contributions.html'];
const EXPECTED_NAV_LINKS = [
  'index.html',
  'github.html',
  'community.html',
  'explore.html',
  'contributions.html',
];

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
  } catch (err) {
    console.error(`❌ ${description}`);
    console.error(`   ${err.message}`);
    process.exitCode = 1;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}\n  expected: ${expected}\n  actual:   ${actual}`);
  }
}

function assertTrue(condition, msg) {
  if (!condition) {
    throw new Error(msg);
  }
}

// 测试1：所有页面导航栏链接一致
test('所有页面导航栏包含5个链接且顺序一致', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(__dirname, page), 'utf-8');
    let navMatches = html.match(/class="nav-link"[^>]*href="([^"]+)"/g);
    if (!navMatches || navMatches.length !== 5) {
      // 再尝试另一种顺序
      const altMatches = html.match(/href="([^"]+)"[^>]*class="nav-link"/g);
      if (altMatches && altMatches.length === 5) {
        navMatches = altMatches;
      }
    }
    assertTrue(navMatches !== null, `${page}: 未找到导航栏链接`);
    assertEqual(navMatches.length, 5, `${page}: 导航栏链接数量应为5个`);

    const links = navMatches.map((m) => {
      const match = m.match(/href="([^"]+)"/);
      return match ? match[1] : null;
    });

    for (let i = 0; i < EXPECTED_NAV_LINKS.length; i++) {
      assertEqual(
        links[i],
        EXPECTED_NAV_LINKS[i],
        `${page}: 第${i + 1}个导航链接不匹配`
      );
    }
  }
});

// 测试2：导航栏CSS设置了固定字体
test('style.css为.nav-menu和.nav-link设置了固定字体', () => {
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf-8');
  assertTrue(
    css.includes("font-family: 'Researcher', 'OriginTech', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"),
    'style.css 中缺少导航栏固定字体设置'
  );
  assertTrue(
    css.includes('letter-spacing: normal'),
    'style.css 中缺少导航栏 letter-spacing: normal 设置'
  );
});

// 测试3：没有CSS语法错误
test('所有HTML文件中不存在 CSS important! 语法错误', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(__dirname, page), 'utf-8');
    assertTrue(
      !html.includes('important!'),
      `${page}: 仍存在 CSS 语法错误 'important!'（应为 '!important'）`
    );
    assertTrue(
      html.includes('!important'),
      `${page}: 缺少 '!important' 关键字`
    );
  }
});

// 测试4：index.html 没有 eightgon-page 类（这是预期行为，子页面有）
test('首页(index.html)不使用 eightgon-page 字体类', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  assertTrue(
    !html.includes('class="eightgon-page"'),
    'index.html 不应包含 eightgon-page 类（这是设计意图）'
  );
});

// 测试5：子页面仍保留 eightgon-page 类（用于页面正文内容字体）
test('子页面保留 eightgon-page 类用于正文内容字体', () => {
  const subPages = ['github.html', 'community.html', 'explore.html', 'contributions.html'];
  for (const page of subPages) {
    const html = fs.readFileSync(path.join(__dirname, page), 'utf-8');
    assertTrue(
      html.includes('class="eightgon-page"'),
      `${page}: 应保留 eightgon-page 类以维持正文 Eightgon 字体风格`
    );
  }
});

console.log('\n📊 测试完成。');
if (process.exitCode === 1) {
  console.log('部分测试未通过，请检查修复。');
} else {
  console.log('全部测试通过！✨');
}
