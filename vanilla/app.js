// ============================================================
// JVM 垃圾回收解谜挑战 - 原生 JavaScript 版
// 零外部依赖，纯手工 DOM / SVG 渲染
// ============================================================

// ============================================================
// 第一部分：关卡数据（从 React LevelData.js 移植）
// ============================================================

const LEVELS = [
  // ---- Level 0: 沙盒模式 ----
  {
    id: 0,
    name: '沙盒模式',
    description: '自由编辑模式，不受关卡限制',
    goal: '自由探索 GC 算法工作原理，随意添加 / 删除节点和引用',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'Root', type: 'root', x: 100, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'node_a', name: 'Obj_A', type: 'object', x: 260, y: 250, size: 30, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-root-a', from: 'root', to: 'node_a' },
    ],
    javaCode: [],
    checkWin: function () { return false; },
  },

  // ---- Level 1: 静态集合 ----
  {
    id: 1,
    name: '静态集合',
    description: 'static List 属于 GC Root，临时数据被 add 后无法被 JVM 回收',
    goal: '回收 tempData',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'JVM_Roots', type: 'root', x: 80, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'staticCache', name: 'staticCache', type: 'object', x: 220, y: 250, size: 2, state: 'idle', refCount: 1 },
      { id: 'tempData', name: 'tempData', type: 'object', x: 380, y: 250, size: 100, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-root-cache', from: 'root', to: 'staticCache' },
      { id: 'e-cache-temp', from: 'staticCache', to: 'tempData' },
    ],
    javaCode: [
      { text: 'public class CacheManager {', alwaysNormal: true },
      { text: '    // static 变量属于 GC Root', alwaysNormal: true },
      { text: '    private static List<Object> cache = new ArrayList<>();', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void process() {', alwaysNormal: true },
      { text: '        // 创建 100MB 临时数据', alwaysNormal: true },
      { text: '        Object tempData = new byte[100 * 1024 * 1024];', alwaysNormal: true },
      { text: '        // 连线存在时 => 泄漏（高亮）', alwaysNormal: true },
      { text: '        cache.add(tempData);', activeEdge: 'e-cache-temp', commentText: '        // cache.add(tempData); // 已解绑' },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: function (nodes) { return !nodes.some(function (n) { return n.id === 'tempData'; }); },
  },

  // ---- Level 2: 循环引用 ----
  {
    id: 2,
    name: '循环引用',
    description: '两个孤立对象互相持有引用（b ⇄ c），引用计数无法归零',
    goal: '清除相互引用对象',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'JVM_Roots', type: 'root', x: 80, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'node_b', name: 'Obj_B', type: 'object', x: 300, y: 170, size: 30, state: 'idle', refCount: 1 },
      { id: 'node_c', name: 'Obj_C', type: 'object', x: 300, y: 330, size: 30, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-b-c', from: 'node_b', to: 'node_c' },
      { id: 'e-c-b', from: 'node_c', to: 'node_b' },
    ],
    javaCode: [
      { text: 'class Node { Node next; }', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: 'Node b = new Node();', alwaysNormal: true },
      { text: 'Node c = new Node();', alwaysNormal: true },
      { text: 'b.next = c;', alwaysNormal: true },
      { text: 'c.next = b; // 剪断此线使引用计数归零', activeEdge: 'e-c-b', commentText: 'c.next = b; // 已解绑' },
      { text: '', alwaysNormal: true },
      { text: '// 引用计数面对循环引用时的局限性：', alwaysNormal: true },
      { text: '// 即使 Root 不再引用，b 和 c 互相持有', alwaysNormal: true },
      { text: '// 导致引用计数永远不会归零', alwaysNormal: true },
    ],
    checkWin: function (nodes) { return !nodes.some(function (n) { return n.id === 'node_b' || n.id === 'node_c'; }); },
  },

  // ---- Level 3: 堆内存强引用 ----
  {
    id: 3,
    name: '堆内存强引用',
    description: '存在多条冗余强引用指向大缓冲区，内存无法释放',
    goal: '使活动内存降至 10MB 以下',
    memoryLimit: 10,
    initialNodes: [
      { id: 'root', name: 'Root', type: 'root', x: 60, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'heavyComp', name: 'HeavyComp', type: 'object', x: 200, y: 190, size: 8, state: 'idle', refCount: 1 },
      { id: 'bigBuffer', name: 'bigBuffer', type: 'object', x: 360, y: 250, size: 150, state: 'idle', refCount: 2 },
    ],
    initialEdges: [
      { id: 'e-root-comp', from: 'root', to: 'heavyComp' },
      { id: 'e-comp-buf', from: 'heavyComp', to: 'bigBuffer' },
      { id: 'e-root-buf', from: 'root', to: 'bigBuffer' },
    ],
    javaCode: [
      { text: 'public class DataHandler {', alwaysNormal: true },
      { text: '    private byte[] bigBuffer = new byte[150 * 1024 * 1024];', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public byte[] getBigBuffer() { return bigBuffer; }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '// 某处业务代码不小心将 handler.getBigBuffer()', alwaysNormal: true },
      { text: '// 赋值给了长生命周期的全局变量，导致 Root → bigBuffer 冗余链路', activeEdge: 'e-root-buf', commentText: '    // 冗余链路已断开' },
      { text: '', alwaysNormal: true },
      { text: '    public void clear() {', alwaysNormal: true },
      { text: '        // 切断核心引用 (HeavyComp → bigBuffer)', alwaysNormal: true },
      { text: '        this.bigBuffer = null; // 释放强引用', activeEdge: 'e-comp-buf', commentText: '        // this.bigBuffer = null; // 已释放' },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: function (nodes) {
      var activeMemory = nodes.reduce(function (sum, n) { return sum + (n.size || 0); }, 0);
      return activeMemory <= 10;
    },
  },

  // ---- Level 4: 监听器未注销 ----
  {
    id: 4,
    name: '监听器未注销',
    description: '全局 EventPublisher 保留对短生命周期组件的监听器引用',
    goal: '清除监听器组件',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'JVM_Roots', type: 'root', x: 50, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'publisher', name: 'EventPublisher', type: 'dom', x: 200, y: 180, size: 5, state: 'idle', refCount: 1 },
      { id: 'listener', name: 'Listener', type: 'purple', x: 200, y: 320, size: 2, state: 'idle', refCount: 1 },
      { id: 'heavyComp', name: 'HeavyComp', type: 'object', x: 370, y: 250, size: 80, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-root-pub', from: 'root', to: 'publisher' },
      { id: 'e-pub-listener', from: 'publisher', to: 'listener' },
      { id: 'e-listener-comp', from: 'listener', to: 'heavyComp' },
    ],
    javaCode: [
      { text: '// 80MB 大对象组件', alwaysNormal: true },
      { text: 'public class HeavyComponent {', alwaysNormal: true },
      { text: '    private byte[] data = new byte[80 * 1024 * 1024];', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    private Listener listener = new Listener() { // 2MB', alwaysNormal: true },
      { text: '        // 匿名内部类 ⟹ 隐式持有外部类引用', alwaysNormal: true },
      { text: '        // 对应图中的 Listener ──→ HeavyComp', alwaysNormal: true },
      { text: '    };', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void start() {', alwaysNormal: true },
      { text: '        // 向全局事件源注册（图中 e-pub-listener 连线）', activeEdge: 'e-pub-listener', commentText: '        // 已解绑（连线已断）' },
      { text: '        EventPublisher.register(listener); // 泄漏源', activeEdge: 'e-pub-listener', commentText: '        // EventPublisher.register(listener); // 已修复' },
      { text: '    }', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void destroy() {', alwaysNormal: true },
      { text: '        // 忘记取消注册！Listener 仍被 EventPublisher 持有', activeEdge: 'e-pub-listener', commentText: '        // 已取消注册' },
      { text: '        // EventPublisher.unregister(listener);', activeEdge: 'e-pub-listener', commentText: '        EventPublisher.unregister(listener); // 已注销' },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: function (nodes) {
      // heavyComp 被回收 且 e-pub-listener 连线已被切断
      var listenerEdgeStillExists = edges.some(function (e) { return e.id === 'e-pub-listener'; });
      return !nodes.some(function (n) { return n.id === 'heavyComp'; }) && !listenerEdgeStillExists;
    },
  },

  // ---- Level 5: ThreadLocal 遗留 ----
  {
    id: 5,
    name: 'ThreadLocal 遗留',
    description: '线程池复用线程但未调用 ThreadLocal.remove()，大对象残留',
    goal: '清理线程局部变量',
    memoryLimit: null,
    initialNodes: [
      { id: 'thread', name: 'Thread', type: 'root', x: 70, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'tlMap', name: 'ThreadLocalMap', type: 'purple', x: 240, y: 250, size: 5, state: 'idle', refCount: 1 },
      { id: 'userCtx', name: 'UserContext', type: 'object', x: 410, y: 250, size: 80, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-thread-tl', from: 'thread', to: 'tlMap' },
      { id: 'e-tl-ctx', from: 'tlMap', to: 'userCtx' },
    ],
    javaCode: [
      { text: 'public class WebFilter {', alwaysNormal: true },
      { text: '    private static ThreadLocal<Context> holder = new ThreadLocal<>();', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void doFilter() {', alwaysNormal: true },
      { text: '        try {', alwaysNormal: true },
      { text: '            // 设置线程本地上下文（80MB）', alwaysNormal: true },
      { text: '            holder.set(new Context());', alwaysNormal: true },
      { text: '        } finally {', alwaysNormal: true },
      { text: '            // 忘记调用 remove()！', activeEdge: 'e-tl-ctx', commentText: '            // ThreadLocal 已清理' },
      { text: '            // holder.remove();', activeEdge: 'e-tl-ctx', commentText: '            holder.remove(); // ThreadLocal 已清理' },
      { text: '        }', alwaysNormal: true },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: function (nodes) { return !nodes.some(function (n) { return n.id === 'userCtx'; }); },
  },

  // ---- Level 6: 未取消的后台 Timer ----
  {
    id: 6,
    name: '未取消的后台 Timer',
    description: 'java.util.Timer 线程未调用 cancel()，持有外部类无法被 GC',
    goal: '清除TimerTask对象',
    memoryLimit: null,
    initialNodes: [
      { id: 'root', name: 'JVM_Roots', type: 'root', x: 60, y: 250, size: 0, state: 'idle', refCount: 0 },
      { id: 'timer', name: 'java.util.Timer', type: 'purple', x: 220, y: 200, size: 5, state: 'idle', refCount: 1 },
      { id: 'task', name: 'TimerTask', type: 'object', x: 220, y: 330, size: 10, state: 'idle', refCount: 1 },
      { id: 'heavyComp', name: 'HeavyComp', type: 'object', x: 380, y: 280, size: 60, state: 'idle', refCount: 1 },
    ],
    initialEdges: [
      { id: 'e-root-timer', from: 'root', to: 'timer' },
      { id: 'e-timer-task', from: 'timer', to: 'task' },
      { id: 'e-task-comp', from: 'task', to: 'heavyComp' },
    ],
    javaCode: [
      { text: 'import java.util.Timer;', alwaysNormal: true },
      { text: 'import java.util.TimerTask;', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: 'public class Service {', alwaysNormal: true },
      { text: '    private Timer timer = new Timer(); // 后台线程', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void start() {', alwaysNormal: true },
      { text: '        timer.schedule(new HeavyTask(), 0, 1000);', alwaysNormal: true },
      { text: '    }', alwaysNormal: true },
      { text: '', alwaysNormal: true },
      { text: '    public void stopService() {', alwaysNormal: true },
      { text: '        // 忘记 cancel() 导致 Timer 线程常驻', activeEdge: 'e-root-timer', commentText: '        // 定时器已取消' },
      { text: '        // timer.cancel();', activeEdge: 'e-root-timer', commentText: '        timer.cancel(); // 已取消' },
      { text: '    }', alwaysNormal: true },
      { text: '}', alwaysNormal: true },
    ],
    checkWin: function (nodes) { return !nodes.some(function (n) { return n.id === 'heavyComp'; }); },
  },
];

// ============================================================
// 第二部分：全局状态
// ============================================================

var nodes = [];
var edges = [];
var currentLevel = 0;
var isSimulating = false;
var draggedNodeId = null;
var linkingMode = false;
var linkingSourceId = null;
var isDeleteEdgeMode = false;
var deleteEdgeFromId = null;
var levelCompleted = false;
var nodeCounter = 2; // 从沙盒初始节点数开始
var dragOccurred = false;

// ---- 关卡锁定系统 ----
var completedLevels = new Set();
var initialMemory = 0;

// 从 localStorage 恢复已通关记录
(function loadCompletedLevels() {
  try {
    var saved = localStorage.getItem('gc-sandbox-completed');
    if (saved) {
      var arr = JSON.parse(saved);
      arr.forEach(function (id) { completedLevels.add(id); });
    }
  } catch (e) { /* ignore */ }
})();

function isLevelUnlocked(levelId) {
  if (levelId === 0) return true;  // 沙盒始终开放
  if (levelId === 1) return true;  // L1 始终开放
  return completedLevels.has(levelId - 1);
}

function saveCompletedLevels() {
  try {
    localStorage.setItem('gc-sandbox-completed', JSON.stringify(Array.from(completedLevels)));
  } catch (e) { /* ignore */ }
}

function updateLevelSelectOptions() {
  var select = document.getElementById('level-select');
  var options = select.querySelectorAll('option');
  var levelNames = [
    '沙盒模式',
    'L1: 静态集合',
    'L2: 循环引用',
    'L3: 堆内存强引用',
    'L4: 监听器未注销',
    'L5: ThreadLocal 遗留',
    'L6: 未取消的后台 Timer'
  ];
  options.forEach(function (opt, idx) {
    if (idx >= levelNames.length) return;
    var unlocked = isLevelUnlocked(idx);
    opt.disabled = !unlocked;
    opt.textContent = unlocked ? levelNames[idx] : levelNames[idx] + ' [已锁定]';
  });
}

// ============================================================
// 第三部分：辅助函数
// ============================================================

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function getNeighbors(nodeId) {
  return edges.filter(function (e) { return e.from === nodeId; }).map(function (e) { return e.to; });
}

/**
 * 获取画布容器的居中坐标
 */
function getCanvasCenter() {
  var canvas = document.getElementById('canvas-container');
  if (!canvas) return { x: 400, y: 250 };
  var rect = canvas.getBoundingClientRect();
  return { x: rect.width / 2, y: rect.height / 2 };
}

/**
 * 将一组节点平移到画布中心
 */
function recenterNodes(nodeArray) {
  if (!nodeArray || nodeArray.length === 0) return nodeArray;
  var center = getCanvasCenter();
  // 计算当前重心
  var avgX = 0, avgY = 0;
  nodeArray.forEach(function (n) { avgX += n.x; avgY += n.y; });
  avgX /= nodeArray.length;
  avgY /= nodeArray.length;
  var dx = Math.round(center.x - avgX);
  var dy = Math.round(center.y - avgY);
  return nodeArray.map(function (n) {
    return { id: n.id, name: n.name, type: n.type, x: n.x + dx, y: n.y + dy, size: n.size, isRoot: n.isRoot || n.type === 'root', state: 'idle', refCount: 0 };
  });
}

function getLevelData() {
  return LEVELS[currentLevel] || LEVELS[0];
}

function getActiveMemory() {
  return nodes.reduce(function (sum, n) { return sum + (n.size || 0); }, 0);
}

// ============================================================
// 第四部分：核心渲染引擎
// ============================================================

function render() {
  updateRefCounts();
  renderNodes();
  renderLines();
  renderCodePanel();
  renderLevelInfo();
  updateUI();
}

// ---- 4.1 渲染节点 ----
function renderNodes() {
  var canvas = document.getElementById('canvas-container');

  // 清除旧的节点 DOM
  var oldNodes = canvas.querySelectorAll('.node');
  oldNodes.forEach(function (n) { n.remove(); });

  // 重新生成
  nodes.forEach(function (node) {
    var div = document.createElement('div');
    div.id = node.id;

    var classes = ['node'];
    if (node.isRoot) classes.push('root-node');
    if (node.type === 'dom') classes.push('dom-node');
    if (node.type === 'purple') classes.push('purple-node');
    if (node.state === 'marked') classes.push('marked-node');
    if (node.state === 'sweeping') classes.push('sweeping-node');
    if (linkingSourceId === node.id) classes.push('linking-source');
    if (deleteEdgeFromId === node.id) classes.push('delete-target');

    div.className = classes.join(' ');
    div.style.left = node.x + 'px';
    div.style.top = node.y + 'px';

    var badgeHTML = '';
    if (!node.isRoot) {
      badgeHTML = '<span class="ref-count-badge">rc: ' + (node.refCount || 0) + '</span>';
    }
    var sizeBadge = '';
    if (node.size > 0) {
      sizeBadge = '<span class="size-badge">' + node.size + 'MB</span>';
    }
    div.innerHTML = '<span>' + node.name + '</span>' + badgeHTML + sizeBadge;

    // 鼠标按下：开始拖拽
    div.addEventListener('mousedown', function (e) {
      if (isSimulating) return;
      e.stopPropagation();
      dragOccurred = false;
      draggedNodeId = node.id;
    });

    // 点击：连线 / 删除边 / 普通点击
    div.addEventListener('click', function () {
      handleNodeClick(node.id);
    });

    // 右键：删除节点
    div.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (isSimulating) return;
      deleteNode(node.id);
    });

    canvas.appendChild(div);
  });
}

// ---- 4.2 渲染连线 ----
function renderLines() {
  var svg = document.getElementById('svg-canvas');

  var oldLines = svg.querySelectorAll('line');
  oldLines.forEach(function (l) { l.remove(); });

  var svgNS = "http://www.w3.org/2000/svg";

  edges.forEach(function (edge) {
    var source = null;
    var target = null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === edge.from) source = nodes[i];
      if (nodes[i].id === edge.to) target = nodes[i];
    }
    if (!source || !target) return;

    var line = document.createElementNS(svgNS, "line");

    line.setAttribute("x1", source.x);
    line.setAttribute("y1", source.y);
    line.setAttribute("x2", target.x);
    line.setAttribute("y2", target.y);

    var isHighlighted = source.state === 'marked';
    line.setAttribute("stroke", isHighlighted ? '#eab308' : '#94a3b8');
    line.setAttribute("stroke-width", isHighlighted ? '2.5' : '1.5');
    line.setAttribute("marker-end", isHighlighted ? 'url(#arrow-highlight)' : 'url(#arrow)');

    svg.appendChild(line);
  });
}

// ---- 4.3 沙盒模式：根据当前节点图动态生成 Java 对照代码 ----
function generateSandboxJavaCode() {
  var objNodes = nodes.filter(function (n) { return !n.isRoot; });
  var rootNodes = nodes.filter(function (n) { return n.isRoot; });

  // 尚无用户节点时显示引导信息
  if (objNodes.length === 0) {
    return '<div style="color: #94a3b8; font-size: 13px; text-align: center; padding: 40px 20px;">' +
           '<p style="margin: 0 0 8px 0; font-size: 20px;">Sandbox</p>' +
           '<p style="margin: 0;">暂无内存对象</p>' +
           '</div>';
  }

  var html = '';
  var lineNum = 0;

  function addLine(text, cls) {
    lineNum++;
    cls = cls || 'normal';
    html += '<span class="code-line ' + cls + '">' +
            '<span class="code-line-number">' + lineNum + '</span>' +
            escapeHtml(text) +
            '</span>';
  }

  // ---- 类型推断辅助 ----
  function getTypeName(node) {
    if (node.type === 'dom') return 'EventListener';
    if (node.type === 'purple') return 'ThreadLocal';
    if (node.isRoot) return 'GC Root';
    if (node.size > 0) return 'MemBlock';
    return 'Object';
  }

  function getVarName(name) {
    // 驼峰命名：首字母小写，移除下划线（支持 _A → A, _a → A）
    var camel = name.replace(/_([a-zA-Z])/g, function (g) { return g[1].toUpperCase(); });
    return camel.charAt(0).toLowerCase() + camel.slice(1);
  }

  // ---- 生成代码 ----
  addLine('public class SandboxMemory {', 'normal');
  addLine('', 'normal');
  addLine('    // ======== 内存块包装类 ========', 'normal');
  addLine('    static class MemBlock {', 'normal');
  addLine('        byte[] data;', 'normal');
  addLine('        MemBlock next;', 'normal');
  addLine('        public MemBlock(int size) { this.data = new byte[size]; }', 'normal');
  addLine('    }', 'normal');
  addLine('', 'normal');
  addLine('    // ======== 内存对象图 ========', 'normal');
  addLine('    // Root 节点: ' + rootNodes.map(function (r) { return r.name; }).join(', '), 'normal');
  addLine('    // 对象总数: ' + objNodes.length + ' | 总内存: ' + getActiveMemory() + 'MB', 'normal');
  addLine('', 'normal');

  // 1) 从 Root 出发的静态引用
  var rootRefdIds = {};
  var hasStaticRef = false;
  rootNodes.forEach(function (root) {
    var outgoing = edges.filter(function (e) { return e.from === root.id; });
    outgoing.forEach(function (e) {
      var target = null;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].id === e.to) { target = nodes[i]; break; }
      }
      if (target && !target.isRoot) {
        rootRefdIds[target.id] = true;
        hasStaticRef = true;
        addLine('    // GC Root "' + root.name + '" 持有 ' + target.name, 'normal');
        addLine('    private static ' + getTypeName(target) + ' ' + getVarName(target.name) + ';', 'normal');
      }
    });
  });

  if (hasStaticRef) {
    addLine('', 'normal');
  }

  addLine('    public static void main(String[] args) {', 'normal');

  // 2) 对象分配（按是否有入边排序：有引用的先分配）
  var sortedObjs = objNodes.slice().sort(function (a, b) {
    var inA = edges.filter(function (e) { return e.to === a.id; }).length;
    var inB = edges.filter(function (e) { return e.to === b.id; }).length;
    return inB - inA; // 引用多的先分配
  });

  sortedObjs.forEach(function (node) {
    var incomingEdges = edges.filter(function (e) { return e.to === node.id; });
    var outgoingEdges = edges.filter(function (e) { return e.from === node.id; });
    var refCount = incomingEdges.length;
    var typeName = getTypeName(node);
    var varName = getVarName(node.name);
    var refFromRoot = rootRefdIds[node.id] || incomingEdges.some(function (e) {
      return rootNodes.some(function (r) { return r.id === e.from; });
    });

    addLine('', 'normal');

    // 注释：节点信息
    var comment = '    // ' + node.name;
    if (node.size > 0) comment += ' | ' + node.size + 'MB';
    if (refFromRoot) comment += ' | 被 GC Root 引用';
    comment += ' | 入边: ' + refCount + ' | 出边: ' + outgoingEdges.length;
    addLine(comment, 'normal');

    // 分配语句（若已被声明为 static，则直接赋值以避免局部变量遮蔽）
    if (typeName === 'MemBlock' && node.size > 0) {
      if (refFromRoot) {
        addLine('    ' + varName + ' = new MemBlock(' + node.size + ' * 1024 * 1024);', 'normal');
      } else {
        addLine('    ' + typeName + ' ' + varName + ' = new MemBlock(' + node.size + ' * 1024 * 1024);', 'normal');
      }
    } else if (typeName === 'EventListener') {
      addLine('    ' + typeName + ' ' + varName + ' = new EventListener() {', 'normal');
      addLine('        public void onEvent(Object data) {', 'normal');
      addLine('            // handle event...', 'normal');
      addLine('        }', 'normal');
      addLine('    };', 'normal');
    } else if (typeName === 'ThreadLocal') {
      addLine('    ' + typeName + '<Object> ' + varName + ' = new ThreadLocal<>();', 'normal');
      addLine('    ' + varName + '.set(new byte[' + (node.size || 5) + ' * 1024 * 1024]);', 'normal');
    } else {
      addLine('    ' + typeName + ' ' + varName + ' = new Object();', 'normal');
    }

    // 出边：显示引用关系
    outgoingEdges.forEach(function (e) {
      var target = null;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].id === e.to) { target = nodes[i]; break; }
      }
      if (target) {
        var tVar = getVarName(target.name);
        if (typeName === 'MemBlock') {
          addLine('    ' + varName + '.next = ' + tVar + '; // 🟢 B 指向 C', 'normal');
        } else {
          addLine('    ' + varName + '.next = ' + tVar + ';', 'normal');
        }
      }
    });
  });

  addLine('', 'normal');
  addLine('    // ======== 当前引用关系 ========', 'normal');

  // 3) 汇总所有引用
  edges.forEach(function (e) {
    var src = null, tgt = null;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === e.from) src = nodes[i];
      if (nodes[i].id === e.to) tgt = nodes[i];
    }
    if (src && tgt) {
      addLine('    // ' + src.name + ' ──→ ' + tgt.name, 'normal');
    }
  });

  addLine('', 'normal');
  addLine('    // ======== GC 分析 ========', 'normal');
  // 找出不可达对象（从 root BFS 可达性分析）
  var reachable = new Set();
  var queue = [];
  rootNodes.forEach(function (r) { queue.push(r.id); });
  while (queue.length > 0) {
    var c = queue.shift();
    if (reachable.has(c)) continue;
    reachable.add(c);
    edges.filter(function (e) { return e.from === c; }).forEach(function (e) {
      queue.push(e.to);
    });
  }

  objNodes.forEach(function (n) {
    if (!reachable.has(n.id)) {
      addLine('    // ! ' + n.name + ' 不可达 — GC 可回收 ' + (n.size || 0) + 'MB', 'normal');
    }
  });

  var reachableCount = objNodes.filter(function (n) { return reachable.has(n.id); }).length;
  var unreachableCount = objNodes.length - reachableCount;
  addLine('    // 可到达对象: ' + reachableCount + ' | 垃圾对象: ' + unreachableCount + ' | 活跃内存: ' + getActiveMemory() + 'MB', 'normal');

  addLine('    }', 'normal');
  addLine('}', 'normal');

  return html;
}

// ---- 4.4 渲染代码面板 ----
function renderCodePanel() {
  var codeArea = document.getElementById('code-area');
  var levelData = getLevelData();

  if (levelData.javaCode.length === 0) {
    // 沙盒模式：动态生成 Java 对照代码
    codeArea.innerHTML = generateSandboxJavaCode();
    return;
  }

  var html = '';
  for (var i = 0; i < levelData.javaCode.length; i++) {
    var line = levelData.javaCode[i];
    var lineClass = 'normal';

    if (line.alwaysNormal) {
      lineClass = 'normal';
    } else if (line.activeEdge) {
      var edgeExists = edges.some(function (e) { return e.id === line.activeEdge; });
      if (edgeExists) {
        lineClass = 'active';
      } else {
        lineClass = 'comment';
      }
    }

    var displayText = line.text;
    if (lineClass === 'comment' && line.commentText) {
      displayText = line.commentText;
    }

    html += '<span class="code-line ' + lineClass + '">' +
            '<span class="code-line-number">' + (i + 1) + '</span>' +
            escapeHtml(displayText) +
            '</span>';
  }

  codeArea.innerHTML = html;
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

// ---- 4.4 渲染关卡信息 ----
function renderLevelInfo() {
  var infoArea = document.getElementById('level-info-area');
  var levelData = getLevelData();

  if (currentLevel === 0) {
    infoArea.innerHTML = '';
    return;
  }

  var activeMemory = getActiveMemory();
  var memoryHtml = '';
  if (levelData.memoryLimit) {
    var withinLimit = activeMemory <= levelData.memoryLimit;
    memoryHtml =
      '<div class="memory-indicator">' +
      '<span>当前内存</span>' +
      '<span><span class="memory-value' + (withinLimit ? ' within-limit' : '') + '">' + activeMemory + ' MB</span>' +
      '<span class="memory-limit"> / ' + levelData.memoryLimit + ' MB</span></span>' +
      '</div>';
  }

  infoArea.innerHTML =
    '<div class="level-info">' +
    '<h3>' + levelData.name + '</h3>' +
    '<p class="level-description">' + levelData.description + '</p>' +
    '<p class="level-goal">目标：' + levelData.goal + '</p>' +
    (levelData.memoryLimit ? '<p class="level-memory">限制：活动内存 ≤ ' + levelData.memoryLimit + ' MB</p>' : '') +
    memoryHtml +
    '</div>';
}

// ---- 4.5 更新 UI（按钮状态 + 指示器 + 徽章 + 提示）----
function updateUI() {
  // 按钮禁用状态
  var allButtons = document.querySelectorAll('button');
  allButtons.forEach(function (btn) {
    btn.disabled = isSimulating;
  });

  // 关卡选择器
  document.getElementById('level-select').disabled = isSimulating;

  // 更新下拉框选项的锁定状态
  updateLevelSelectOptions();

  // 连线按钮文字
  var linkBtn = document.getElementById('btn-link');
  if (linkingMode) {
    linkBtn.textContent = '退出连线模式';
    linkBtn.classList.add('btn-active');
  } else {
    linkBtn.textContent = '连线模式';
    linkBtn.classList.remove('btn-active');
  }

  // 删除连线按钮文字
  var delBtn = document.getElementById('btn-delete-edge');
  if (isDeleteEdgeMode) {
    delBtn.textContent = '退出删除连线';
    delBtn.classList.add('btn-active');
  } else {
    delBtn.textContent = '删除连线';
    delBtn.classList.remove('btn-active');
  }

  // ---- 关卡级别按钮禁用 ----
  var btnMS = document.getElementById('btn-ms');
  var btnRC = document.getElementById('btn-rc');
  // Level 2: 强制执行引用计数（禁用 Mark-Sweep）
  if (currentLevel === 2) {
    btnMS.disabled = true;
    btnMS.title = '本关卡限定使用引用计数 GC';
    btnMS.style.opacity = '0.4';
    btnRC.title = '使用引用计数 GC 解开循环引用';
  } else {
    btnMS.title = '标记-清除 (Mark-Sweep)';
    btnMS.style.opacity = '';
  }

  // ---- Level 4 专属：显示 "卸下组件" 按钮 ----
  var levelActionBtns = document.getElementById('level-action-buttons');
  var btnDismantle = document.getElementById('btn-dismantle');
  if (currentLevel === 4) {
    levelActionBtns.style.display = 'block';
    btnDismantle.style.display = 'block';
  } else {
    levelActionBtns.style.display = 'none';
    btnDismantle.style.display = 'none';
  }

  // 模式指示器
  var indicator = document.getElementById('mode-indicator');
  var levelData = getLevelData();

  var bgColor = '#0f172a';
  var text = '';

  if (isSimulating) {
    bgColor = '#c2410c';
    text = '模拟运行中...';
  } else if (linkingMode) {
    bgColor = '#1d4ed8';
    text = '连线模式 — 点击两个节点建立引用';
  } else if (isDeleteEdgeMode) {
    bgColor = '#dc2626';
    text = '删除连线模式 — 依次点击两节点';
  } else if (currentLevel === 2) {
    bgColor = '#c2410c';
    text = '关卡 2 限制：仅可使用引用计数 (RC) 回收';
  } else if (currentLevel > 0) {
    bgColor = '#0f172a';
    text = levelData.name + ' — 按目标操作';
  } else {
    bgColor = '#0f172a';
    text = '沙盒模式 — 自由编辑';
  }

  indicator.textContent = text;
  indicator.style.backgroundColor = bgColor;
  indicator.style.border = (isSimulating || linkingMode || isDeleteEdgeMode || currentLevel === 2) ? '1px solid transparent' : '1px solid #e2e8f0';

  // 通关弹窗
  if (levelCompleted && currentLevel > 0) {
    showCongratsOverlay();
  } else {
    closeCongratsOverlay();
  }

  // 提示区 / 重置按钮
  var actionArea = document.getElementById('level-action-area');

  if (currentLevel > 0) {
    actionArea.innerHTML =
      '<button onclick="resetLevel()" style="width: 100%;">重置本关卡</button>';
  } else {
    actionArea.innerHTML = '';
  }
}

// ============================================================
// 第五部分：节点与边的操作
// ============================================================

function addNode() {
  if (isSimulating) return;
  nodeCounter++;
  var center = getCanvasCenter();
  var newNode = {
    id: 'obj_' + Date.now(),
    name: 'Obj_' + nodeCounter,
    type: 'object',
    isRoot: false,
    x: center.x + (Math.random() - 0.5) * 220,
    y: center.y + (Math.random() - 0.5) * 220,
    size: 20 + Math.floor(Math.random() * 60),
    state: 'idle',
    refCount: 0
  };
  nodes.push(newNode);
  render();
}

function deleteNode(nodeId) {
  nodes = nodes.filter(function (n) { return n.id !== nodeId; });
  edges = edges.filter(function (e) { return e.from !== nodeId && e.to !== nodeId; });
  if (linkingSourceId === nodeId) linkingSourceId = null;
  if (deleteEdgeFromId === nodeId) deleteEdgeFromId = null;
  render();
}

function handleNodeClick(nodeId) {
  if (isSimulating) return;
  if (dragOccurred) {
    dragOccurred = false;
    return;
  }

  // 删除连线模式
  if (isDeleteEdgeMode) {
    if (deleteEdgeFromId === null) {
      deleteEdgeFromId = nodeId;
      render();
    } else if (deleteEdgeFromId === nodeId) {
      deleteEdgeFromId = null;
      render();
    } else {
      // 删除从 deleteEdgeFromId 到 nodeId 的边
      edges = edges.filter(function (e) {
        return !(e.from === deleteEdgeFromId && e.to === nodeId);
      });
      deleteEdgeFromId = null;
      isDeleteEdgeMode = false;
      render();
    }
    return;
  }

  // 连线模式
  if (linkingMode) {
    if (linkingSourceId === null) {
      linkingSourceId = nodeId;
      render();
    } else if (linkingSourceId === nodeId) {
      linkingSourceId = null;
      render();
    } else {
      var edgeId = 'e-' + linkingSourceId + '-' + nodeId;
      var exists = edges.some(function (e) { return e.id === edgeId; });
      if (!exists) {
        edges.push({ id: edgeId, from: linkingSourceId, to: nodeId });
      }
      linkingSourceId = null;
      render();
    }
    return;
  }
}

function toggleLinkMode() {
  if (isSimulating) return;
  linkingMode = !linkingMode;
  if (linkingMode) {
    isDeleteEdgeMode = false;
    deleteEdgeFromId = null;
  } else {
    linkingSourceId = null;
  }
  render();
}

function toggleDeleteEdgeMode() {
  if (isSimulating) return;
  isDeleteEdgeMode = !isDeleteEdgeMode;
  if (isDeleteEdgeMode) {
    linkingMode = false;
    linkingSourceId = null;
  } else {
    deleteEdgeFromId = null;
  }
  render();
}

function clearCanvas() {
  var center = getCanvasCenter();
  nodes = [{ id: 'root', name: 'Root', type: 'root', x: center.x, y: center.y, size: 0, isRoot: true, state: 'idle', refCount: 0 }];
  edges = [];
  linkingMode = false;
  linkingSourceId = null;
  isDeleteEdgeMode = false;
  deleteEdgeFromId = null;
  render();
}

function loadCircularPreset() {
  if (isSimulating) return;
  linkingMode = false;
  linkingSourceId = null;
  isDeleteEdgeMode = false;
  deleteEdgeFromId = null;
  var center = getCanvasCenter();
  nodes = recenterNodes([
    { id: 'root', name: 'Root', type: 'root', x: 100, y: 250, size: 0, isRoot: true, state: 'idle', refCount: 0 },
    { id: 'node_a', name: 'Obj_A', type: 'object', x: 280, y: 250, size: 30, isRoot: false, state: 'idle', refCount: 0 },
    { id: 'node_b', name: 'Obj_B', type: 'object', x: 480, y: 140, size: 30, isRoot: false, state: 'idle', refCount: 0 },
    { id: 'node_c', name: 'Obj_C', type: 'object', x: 480, y: 360, size: 30, isRoot: false, state: 'idle', refCount: 0 },
  ]);
  edges = [
    { id: 'e-r-a', from: 'root', to: 'node_a' },
    { id: 'e-b-c', from: 'node_b', to: 'node_c' },
    { id: 'e-c-b', from: 'node_c', to: 'node_b' },
  ];
  render();
}

// ============================================================
// 第六部分：拖拽系统
// ============================================================

function handleMouseMove(e) {
  if (!draggedNodeId || isSimulating) return;
  dragOccurred = true;

  var canvas = document.getElementById('canvas-container');
  var rect = canvas.getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;

  var boundedX = Math.max(30, Math.min(rect.width - 30, x));
  var boundedY = Math.max(30, Math.min(rect.height - 30, y));

  // 同步数据
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].id === draggedNodeId) {
      nodes[i].x = boundedX;
      nodes[i].y = boundedY;
      break;
    }
  }

  // 只移动 DOM 元素，不触发全量重建 (仅重绘连线)
  var div = document.getElementById(draggedNodeId);
  if (div) {
    div.style.left = boundedX + 'px';
    div.style.top = boundedY + 'px';
  }
  renderLines();
}

function handleMouseUp() {
  draggedNodeId = null;
  dragOccurred = false;
}

function handleMouseLeave() {
  draggedNodeId = null;
  dragOccurred = false;
}

// ============================================================
// 第七部分：关卡管理
// ============================================================

function handleLevelChange(value) {
  var newLevel = parseInt(value, 10);

  if (!isLevelUnlocked(newLevel)) {
    // 不允许进入锁定关卡，回退到当前关卡
    document.getElementById('level-select').value = currentLevel;
    return;
  }

  currentLevel = newLevel;
  var level = LEVELS[newLevel];

  nodes = recenterNodes(level.initialNodes.map(function (n) {
    return { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, size: n.size, isRoot: n.isRoot || n.type === 'root', state: 'idle', refCount: 0 };
  }));
  edges = level.initialEdges.map(function (e) {
    return { id: e.id, from: e.from, to: e.to };
  });
  levelCompleted = false;
  initialMemory = level.initialNodes.reduce(function (sum, n) { return sum + (n.size || 0); }, 0);
  linkingMode = false;
  linkingSourceId = null;
  isDeleteEdgeMode = false;
  deleteEdgeFromId = null;
  nodeCounter = level.initialNodes.length;

  // 关闭可能还开着的通关弹窗
  closeCongratsOverlay();

  render();
}

function resetLevel() {
  var level = LEVELS[currentLevel];
  nodes = recenterNodes(level.initialNodes.map(function (n) {
    return { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, size: n.size, isRoot: n.isRoot || n.type === 'root', state: 'idle', refCount: 0 };
  }));
  edges = level.initialEdges.map(function (e) {
    return { id: e.id, from: e.from, to: e.to };
  });
  levelCompleted = false;
  linkingMode = false;
  linkingSourceId = null;
  isDeleteEdgeMode = false;
  deleteEdgeFromId = null;
  render();
}

// ---- L4 专属：卸下组件 ----
function dismantleComponent() {
  if (isSimulating) return;
  if (currentLevel !== 4) return;

  var hintArea = document.getElementById('hint-area');
  var listenerEdgeExists = edges.some(function (e) { return e.id === 'e-pub-listener'; });
  var compExists = nodes.some(function (n) { return n.id === 'heavyComp'; });

  if (!compExists) {
    // 组件已被卸下，但仍需切断 Listener 注册
    if (listenerEdgeExists) {
      hintArea.innerHTML = 'HeavyComponent 已卸下，但 Listener 仍注册中。';
      hintArea.style.color = '#c2410c';
      hintArea.style.border = '1px solid #f97316';
    } else {
      hintArea.innerHTML = '所有引用已切断，泄漏已修复。';
      hintArea.style.color = '#059669';
      hintArea.style.border = '1px solid #10b981';
    }
    return;
  }

  // 移除 listener → comp 的边，模拟"组件销毁"（断开监听器内部引用）
  edges = edges.filter(function (e) { return e.id !== 'e-listener-comp'; });
  // 从画布移除 HeavyComponent 节点
  nodes = nodes.filter(function (n) { return n.id !== 'heavyComp'; });
  render();

  if (listenerEdgeExists) {
    hintArea.innerHTML = '组件已卸下，EventPublisher 仍持有 Listener 引用。';
    hintArea.style.color = '#c2410c';
    hintArea.style.border = '1px solid #f97316';
  } else {
    hintArea.innerHTML = 'Listener 已注销，所有引用已清除。';
    hintArea.style.color = '#059669';
    hintArea.style.border = '1px solid #10b981';
    checkWinCondition();
  }
}

// 通关检测
function checkWinCondition() {
  if (currentLevel === 0) return;
  if (levelCompleted) return;
  var levelData = getLevelData();
  if (levelData.checkWin(nodes)) {
    levelCompleted = true;
    // 记录通关
    completedLevels.add(currentLevel);
    saveCompletedLevels();
    render();
  }
}

// ---- 通关弹窗 ----
function showCongratsOverlay() {
  var overlay = document.getElementById('congrats-overlay');
  if (!overlay) return;

  var freedMem = initialMemory - getActiveMemory();
  document.getElementById('freed-memory').textContent = Math.max(0, freedMem) + ' MB';
  document.getElementById('completed-level-label').textContent = getLevelData().name;

  var nextBtn = document.getElementById('btn-next-level');
  var congratsMessage = document.querySelector('.congrats-message');
  if (currentLevel < 6) {
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = '下一关';
    congratsMessage.textContent = 'Java 源码已成功重构！';
  } else {
    nextBtn.style.display = 'none';
    congratsMessage.textContent = '🎉 恭喜你完成了全部 6 个关卡！\n你已经掌握了 Java 中最经典的 6 种内存泄漏场景及其修复方法。';
  }

  overlay.style.display = 'flex';
}

function closeCongratsOverlay() {
  var overlay = document.getElementById('congrats-overlay');
  if (overlay) overlay.style.display = 'none';
}

function goToNextLevel() {
  if (currentLevel < 6) {
    closeCongratsOverlay();
    var nextLevel = currentLevel + 1;
    document.getElementById('level-select').value = nextLevel;
    handleLevelChange(nextLevel);
  }
}

// ============================================================
// 第七.五部分：代码面板可拖拽分隔条
// ============================================================

function initResizeHandle() {
  var handle = document.getElementById('resize-handle');
  var codePanel = document.querySelector('.code-panel');
  if (!handle || !codePanel) return;

  var isDragging = false;

  function startDrag(e) {
    isDragging = true;
    handle.classList.add('active');
    e.preventDefault();
  }

  function doDrag(e) {
    if (!isDragging) return;
    var clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (clientX == null) return;
    var docWidth = document.documentElement.clientWidth;
    var newWidth = docWidth - clientX;
    newWidth = Math.max(280, Math.min(0.6 * docWidth, newWidth));
    codePanel.style.width = newWidth + 'px';
    if (typeof renderLines === 'function') renderLines();
  }

  function stopDrag() {
    if (isDragging) {
      isDragging = false;
      handle.classList.remove('active');
    }
  }

  handle.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', doDrag);
  document.addEventListener('mouseup', stopDrag);

  // 触屏支持
  handle.addEventListener('touchstart', startDrag);
  document.addEventListener('touchmove', doDrag);
  document.addEventListener('touchend', stopDrag);
}

// ============================================================
// 第八部分：核心 GC 算法
// ============================================================

// ---- 8.1 更新所有节点的引用计数 ----
function updateRefCounts() {
  nodes = nodes.map(function (node) {
    if (node.isRoot) return node;
    var incoming = edges.filter(function (e) { return e.to === node.id; }).length;
    return { id: node.id, name: node.name, type: node.type, x: node.x, y: node.y, size: node.size, isRoot: false, state: node.state, refCount: incoming };
  });
}

// ---- 8.2 标记-清除算法 ----
async function runMarkSweep() {
  if (isSimulating) return;
  isSimulating = true;
  linkingMode = false;
  linkingSourceId = null;
  isDeleteEdgeMode = false;
  deleteEdgeFromId = null;
  render();

  // 重置所有节点状态
  nodes = nodes.map(function (n) { return { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, size: n.size, isRoot: n.isRoot, state: 'idle', refCount: n.refCount }; });
  render();
  await sleep(300);

  // 1. 标记阶段 (BFS 遍历)
  var visited = new Set();
  var queue = [];

  var roots = nodes.filter(function (n) { return n.isRoot; });
  roots.forEach(function (r) { queue.push(r.id); });

  while (queue.length > 0) {
    var currId = queue.shift();
    if (visited.has(currId)) continue;
    visited.add(currId);

    nodes = nodes.map(function (n) {
      if (n.id === currId) {
        return { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, size: n.size, isRoot: n.isRoot, state: 'marked', refCount: n.refCount };
      }
      return n;
    });
    render();
    await sleep(600);

    var neighbors = getNeighbors(currId);
    queue.push.apply(queue, neighbors);
  }

  // 2. 清扫阶段前置动画 (Sweep)
  nodes = nodes.map(function (n) {
    if (!visited.has(n.id)) {
      return { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, size: n.size, isRoot: n.isRoot, state: 'sweeping', refCount: n.refCount };
    }
    return n;
  });
  render();
  await sleep(800);

  // 3. 物理删除
  nodes = nodes.filter(function (n) { return visited.has(n.id); });
  edges = edges.filter(function (e) { return visited.has(e.from) && visited.has(e.to); });

  updateRefCounts();
  isSimulating = false;
  render();

  // 通关检测
  checkWinCondition();
}

// ---- 8.3 引用计数算法 ----
async function runReferenceCounting() {
  if (isSimulating) return;
  isSimulating = true;
  linkingMode = false;
  linkingSourceId = null;
  isDeleteEdgeMode = false;
  deleteEdgeFromId = null;
  render();

  var hasDeleted = true;

  while (hasDeleted) {
    hasDeleted = false;

    // 找出所有引用计数为 0 的非 Root 节点
    var toDelete = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].isRoot) continue;
      var incoming = edges.filter(function (e) { return e.to === nodes[i].id; }).length;
      if (incoming === 0) {
        toDelete.push(nodes[i].id);
      }
    }

    if (toDelete.length > 0) {
      hasDeleted = true;

      // 1. 播放销毁动画
      nodes = nodes.map(function (n) {
        if (toDelete.indexOf(n.id) >= 0) {
          return { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, size: n.size, isRoot: n.isRoot, state: 'sweeping', refCount: n.refCount };
        }
        return n;
      });
      render();
      await sleep(800);

      // 2. 物理删除
      nodes = nodes.filter(function (n) { return toDelete.indexOf(n.id) < 0; });
      edges = edges.filter(function (e) { return toDelete.indexOf(e.from) < 0 && toDelete.indexOf(e.to) < 0; });
    }
  }

  updateRefCounts();
  isSimulating = false;
  render();

  // 通关检测
  checkWinCondition();
}

// ============================================================
// 第八.五部分：攻略指南弹窗
// ============================================================

var currentGuideTab = 0;

function showGameGuide() {
  var overlay = document.getElementById('guide-overlay');
  if (!overlay) return;
  // 默认选择当前关卡的攻略
  var tabIndex = currentLevel > 0 ? currentLevel : 0;
  switchGuideTab(tabIndex);
  overlay.style.display = 'flex';
}

function closeGameGuide() {
  var overlay = document.getElementById('guide-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ESC 键关闭弹窗
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeGameGuide();
    closeCongratsOverlay();
  }
});

// 点击遮罩层关闭弹窗
document.addEventListener('click', function (e) {
  var guideOverlay = document.getElementById('guide-overlay');
  if (guideOverlay && guideOverlay.style.display === 'flex') {
    if (e.target === guideOverlay) {
      closeGameGuide();
    }
  }
  var congratsOverlay = document.getElementById('congrats-overlay');
  if (congratsOverlay && congratsOverlay.style.display === 'flex') {
    if (e.target === congratsOverlay) {
      closeCongratsOverlay();
    }
  }
});

function switchGuideTab(index) {
  currentGuideTab = index;

  // 切换 tab 按钮
  var tabs = document.querySelectorAll('.guide-tab');
  tabs.forEach(function (tab, i) {
    if (i === index) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // 切换面板
  var panels = document.querySelectorAll('.guide-panel');
  panels.forEach(function (panel, i) {
    if (i === index) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
}

// ============================================================
// 第九部分：初始化
// ============================================================

(function init() {
  // 加载沙盒模式
  var level = LEVELS[0];
  nodes = recenterNodes(level.initialNodes.map(function (n) {
    return { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, size: n.size, isRoot: n.isRoot || n.type === 'root', state: 'idle', refCount: 0 };
  }));
  edges = level.initialEdges.map(function (e) {
    return { id: e.id, from: e.from, to: e.to };
  });
  initialMemory = level.initialNodes.reduce(function (sum, n) { return sum + (n.size || 0); }, 0);
  nodeCounter = level.initialNodes.length;

  // 更新下拉框锁定状态
  updateLevelSelectOptions();

  // 初始化代码面板分隔条拖拽
  initResizeHandle();

  render();
})();
