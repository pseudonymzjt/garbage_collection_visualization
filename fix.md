这个硬性要求（**禁止使用外部框架，且外部代码占比 < 10%**）在大学专业课程的大作业/实验中非常普遍。老师这样要求的目的是考察学生**最底层、最纯粹的 DOM 操作和 JS 算法底功**。

不用担心，我们之前的架构设计非常清晰（数据与渲染分离），这使得我们**可以非常丝滑地将 React 代码重构为“100% 纯原生 JavaScript”项目**。这不仅完全符合实验要求，还能实现 **0% 外部代码引用**，拿满“自主代码占比”的分数。

下面是为您量身定制的从 React 到 **原生 JavaScript + CSS + HTML** 的完整重构方案。

---

# 🌐 第一部分：总体重构方案

### 1. 架构转型：从“声明式”到“命令式手动渲染”
*   **React 的逻辑**：修改状态（`setNodes`） ──> React 自动对比虚拟 DOM ──> 浏览器重绘。
*   **原生 JS 的逻辑**：修改全局变量（`nodes = ...`） ──> **手动调用 `render()` 函数** ──> 浏览器重绘。
*   由于我们不需要 React 的打包工具，重构后的项目将只有两个文件：`index.html`（结构 + JS 逻辑）和 `style.css`（样式）。**解压直接双击运行，无任何外部环境依赖。**

### 2. 状态管理转型（用全局变量代替 `useState`）
在 JS 脚本顶部声明全局变量，它们代表我们内存中的真实数据：
```javascript
let nodes = [];          // 存储所有节点对象
let edges = [];          // 存储所有连线对象
let currentLevel = 0;    // 当前关卡
let isSimulating = false;// 是否正在运行 GC
let draggedNodeId = null;// 当前正在拖拽的节点 ID
let linkingSourceId = null; // 连线起点的节点 ID
```

### 3. DOM 与 SVG 动态重建机制
原生 JS 更新界面的最稳妥、最不易出错的方式是**“数据改变后，清空重绘”**：
*   **节点（DOM）**：每次数据变化，清空画布中的旧 `.node` 元素，读取 `nodes` 数组重新 `document.createElement('div')` 并追加到画布中。
*   **连线（SVG）**：每次数据变化，清空 SVG 内部的旧 `<line>` 元素，使用带有命名空间的 `document.createElementNS` 创建新线并追加。

---

# 🛠️ 第二部分：具体修改细节

### 1. 页面骨架重构 (`index.html`)
直接使用原生的 HTML 标签进行三栏布局，按钮直接通过 `onclick` 绑定 JS 函数。

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>JVM 垃圾回收解谜挑战</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app-container">
    <!-- 左侧控制面板 -->
    <div class="control-panel">
      <h2 class="panel-title">GC Sandbox 控制台</h2>
      <div class="btn-group">
        <h3>1. 画布编辑</h3>
        <button id="btn-add" onclick="addNode()">+ 新增内存对象</button>
        <button id="btn-link" onclick="toggleLinkMode()">🔗 开启连线模式</button>
        <button onclick="clearCanvas()">🧹 清空画布</button>
      </div>
      <div class="btn-group">
        <h3>2. 运行垃圾回收</h3>
        <button id="btn-ms" onclick="runMarkSweep()" style="background-color: #eab308;">⚡ 标记-清除 (Mark-Sweep)</button>
        <button id="btn-rc" onclick="runReferenceCounting()" style="background-color: #f97316;">🔄 引用计数 (RC)</button>
      </div>
      <div class="btn-group">
        <h3>3. 游戏关卡选择</h3>
        <button onclick="loadLevel(1)" style="background-color: #8b5cf6;">Level 1: 静态集合膨胀</button>
        <button onclick="loadLevel(2)" style="background-color: #a855f7;">Level 2: 循环引用孤岛</button>
      </div>
    </div>

    <!-- 中间主画布 -->
    <div class="canvas-container" id="canvas-container">
      <!-- 原生 SVG 连线层 -->
      <svg id="svg-canvas" style="position: absolute; width: 100%; height: 100%; pointer-events: none;">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="34" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
          <marker id="arrow-highlight" viewBox="0 0 10 10" refX="34" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#eab308" />
          </marker>
        </defs>
      </svg>
      <!-- 动态创建的节点会被 append 到这里 -->
    </div>

    <!-- 右侧 Java 代码对照区 -->
    <div class="code-panel" id="code-panel">
      <h3 class="panel-title">🔍 Java 源码对照区</h3>
      <pre><code id="code-area">
        <!-- 动态渲染的代码行将插入到这里 -->
      </code></pre>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

### 2. 核心渲染器实现 (`app.js`)
这是原生 JS 方案的关键。每当我们修改了数据，只需要调用一次 `render()`，页面就会完美同步。

```javascript
// app.js

// 统一渲染入口
function render() {
  renderNodes();
  renderLines();
  renderCodePanel();
  updateUIButtons(); // 禁用/启用按钮
}

// 2.1 渲染节点
function renderNodes() {
  const canvas = document.getElementById('canvas-container');
  
  // 清理所有旧的 .node 节点（保留 SVG 标签）
  const oldNodes = canvas.querySelectorAll('.node');
  oldNodes.forEach(n => n.remove());

  // 遍历 nodes 数组重新生成 DOM
  nodes.forEach(node => {
    const div = document.createElement('div');
    div.id = node.id;
    
    // 动态计算类名
    let classList = ['node'];
    if (node.isRoot) classList.push('root-node');
    if (node.type === 'dom') classList.push('dom-node');
    if (node.type === 'purple') classList.push('purple-node');
    if (node.state === 'marked') classList.push('marked-node');
    if (node.state === 'sweeping') classList.push('sweeping-node');
    
    div.className = classList.join(' ');
    div.style.left = node.x + 'px';
    div.style.top = node.y + 'px';
    
    // 节点内部 HTML（名字 + 引用计数角标）
    let badgeHTML = !node.isRoot ? `<span class="ref-count-badge">rc: ${node.refCount || 0}</span>` : '';
    div.innerHTML = `<span>${node.name}</span>${badgeHTML}`;

    // 绑定原生事件
    div.addEventListener('mousedown', (e) => startDrag(node.id, e));
    div.addEventListener('click', () => handleNodeClick(node.id));
    
    // 右键快速删除节点及关联边
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      deleteNode(node.id);
    });

    canvas.appendChild(div);
  });
}

// 2.2 渲染连线（使用 SVG 命名空间）
function renderLines() {
  const svg = document.getElementById('svg-canvas');
  
  // 清除所有旧连线（保留 defs 标记）
  const oldLines = svg.querySelectorAll('line');
  oldLines.forEach(l => l.remove());

  edges.forEach(edge => {
    const source = nodes.find(n => n.id === edge.from);
    const target = nodes.find(n => n.id === edge.to);
    if (!source || !target) return;

    const svgNS = "http://www.w3.org/2000/svg";
    const line = document.createElementNS(svgNS, "line");
    
    line.setAttribute("x1", source.x);
    line.setAttribute("y1", source.y);
    line.setAttribute("x2", target.x);
    line.setAttribute("y2", target.y);
    
    const isHighlighted = source.state === 'marked';
    line.setAttribute("stroke", isHighlighted ? '#eab308' : '#334155');
    line.setAttribute("stroke-width", isHighlighted ? '3' : '2');
    line.setAttribute("marker-end", isHighlighted ? 'url(#arrow-highlight)' : 'url(#arrow)');

    svg.appendChild(line);
  });
}
```

### 3. 原生 JS 拖拽联动实现
脱离框架后，原生拖拽其实非常简单，只需要监听画布上的鼠标移动，并直接修改 DOM 坐标和数据结构，最后调用 `renderLines()` 实时拉伸连线。

```javascript
const canvasContainer = document.getElementById('canvas-container');

// 鼠标按下：开始拖拽
function startDrag(nodeId, e) {
  if (isSimulating) return;
  draggedNodeId = nodeId;
}

// 鼠标移动：更新位置并重绘连线
canvasContainer.addEventListener('mousemove', (e) => {
  if (!draggedNodeId || isSimulating) return;
  
  const rect = canvasContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // 限制边界
  const boundedX = Math.max(30, Math.min(rect.width - 30, x));
  const boundedY = Math.max(30, Math.min(rect.height - 30, y));

  // 1. 同步数据
  const node = nodes.find(n => n.id === draggedNodeId);
  if (node) {
    node.x = boundedX;
    node.y = boundedY;
  }

  // 2. 性能优化：只移动当前的 DOM 元素和连线，不触发全局重建
  const div = document.getElementById(draggedNodeId);
  if (div) {
    div.style.left = boundedX + 'px';
    div.style.top = boundedY + 'px';
  }
  renderLines(); // 实时绘制拉伸的线
});

// 鼠标抬起：结束拖拽
window.addEventListener('mouseup', () => {
  draggedNodeId = null;
});
```

### 4. 异步调度与 GC 算法移植
由于我们是用 `sleep` 配合 `async/await` 实现动画，移植到原生 JS 后完全不需要改动算法逻辑，**只需要在数据改变后手动调用一次 `render()`** 即可。

```javascript
// 标记-清除算法 原生移植
async function runMarkSweep() {
  isSimulating = true;
  render(); // 锁定按钮

  // 重置状态
  nodes = nodes.map(n => n.isRoot ? n : { ...n, state: 'idle' });
  render();
  await sleep(300);

  let queue = [];
  let visited = new Set();
  
  // 寻找 Root
  const roots = nodes.filter(n => n.isRoot);
  roots.forEach(r => queue.push(r.id));

  while (queue.length > 0) {
    let currId = queue.shift();
    if (visited.has(currId)) continue;
    visited.add(currId);

    // 标记当前节点并手动更新 UI
    nodes = nodes.map(n => n.id === currId ? { ...n, state: 'marked' } : n);
    render(); 
    await sleep(600); // 慢动作暂停

    // 获取邻居入队
    let neighbors = edges.filter(e => e.from === currId).map(e => e.to);
    queue.push(...neighbors);
  }

  // 播放 Sweeping 渐隐动画
  nodes = nodes.map(n => !visited.has(n.id) ? { ...n, state: 'sweeping' } : n);
  render();
  await sleep(800); // 等待 CSS 渐隐

  // 物理删除
  nodes = nodes.filter(n => visited.has(n.id));
  edges = edges.filter(e => visited.has(e.from) && visited.has(e.to));
  
  isSimulating = false;
  render(); // 解锁按钮并渲染最终状态
}
```

### 5. Java 代码对照区的动态渲染
右侧面板根据当前选中的关卡（`currentLevel`）和当前的引用关系状态，动态渲染高亮或置灰的 Java 代码行。

```javascript
function renderCodePanel() {
  const codeArea = document.getElementById('code-area');
  
  if (currentLevel === 1) {
    // 关卡 1：检测全局 cache 到 tempData 的连线是否存在
    const hasLeakLine = edges.some(e => e.from === 'staticCache' && e.to === 'tempData');
    
    codeArea.innerHTML = `
<div class="code-line"><span class="code-keyword">public class</span> <span class="code-type">CacheManager</span> {</div>
<div class="code-line">    <span class="code-keyword">private static</span> List&lt;Object&gt; cache = new ArrayList&lt;&gt;();</div>
<div class="code-line">    </div>
<div class="code-line">    <span class="code-keyword">public void</span> process() {</div>
<div class="code-line">        Object tempData = new byte[100 * 1024 * 1024];</div>
<div class="code-line ${hasLeakLine ? 'active' : 'comment'}">
${hasLeakLine ? '        cache.add(tempData);' : '        // cache.add(tempData); // 👈 引用已斩断，内存成功释放！'}
</div>
<div class="code-line">    }
}</div>`;
  } else if (currentLevel === 2) {
    // 关卡 2 的代码展示...
  } else {
    codeArea.innerHTML = `<div>请在左侧选择关卡，开启 Java 内存泄漏解谜挑战。</div>`;
  }
}
```

---

# 📈 方案优势与结论

1.  **外部代码占比：0%**
    通过将逻辑完全写入原生的 `app.js`，HTML、CSS、JS 均为自主编写。项目中**不引入任何外部框架、打包工具或第三方渲染库**，完美契合实验规则中“外部代码占比 < 10%”的要求。
2.  **绝对绿色，即开即用**
    重构后，老师收到你的源码包，**双击 `index.html` 就能直接运行**并展现丝滑的拖拽、慢动作扫描动画，没有任何部署门槛，评分好感度直接拉满。