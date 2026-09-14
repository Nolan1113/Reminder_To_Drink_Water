# 💧 喝水提醒助手

> 一款现代化浏览器插件，帮助你养成健康的饮水习惯。基于 Manifest V3，完全本地运行，无需注册登录，保护隐私。

---

## ✨ 功能特性

- **智能提醒**：使用 `chrome.alarms` 后台定时，浏览器重启后自动恢复，不依赖 setInterval
- **灵活设置**：提醒间隔支持 1~100 分钟任意选择
- **每日目标**：设置每日饮水目标（默认 2000ml），实时显示完成进度
- **精细控制**：可设置提醒时间段、提醒星期（工作日/周末）
- **暂停功能**：支持暂停 30 分钟、1 小时、2 小时、今天不再提醒
- **稍后提醒**：通知中点击「稍后提醒」，10 分钟后再次提醒
- **自定义通知时长**：喝水弹框提醒可自定义在屏幕上停留时间，从 1 秒到 10 分钟任意选择
- **点外卖提醒** 🆕：每日固定时间弹出外卖提醒，时间可自定义，通知时长独立配置
- **本地数据**：所有数据按日期存储在本地，跨天自动新建记录，保留历史
- **隐私安全**：仅申请 `storage`、`alarms`、`notifications` 权限，不读取网页内容

---

## 📁 项目目录结构

```
Reminder_To_Drink_Water/
├── manifest.json                  # 插件清单文件（MV3）
├── README.md                      # 本文档
│
├── assets/
│   └── icons/
│       ├── icon16.png             # 16×16 图标
│       ├── icon32.png             # 32×32 图标
│       ├── icon48.png             # 48×48 图标
│       └── icon128.png            # 128×128 图标
│
├── background/
│   ├── service-worker.js          # SW 入口：事件监听、消息路由
│   ├── alarm-manager.js           # Alarm 生命周期管理（含外卖每日定时）
│   ├── reminder-engine.js         # 判断是否应该提醒
│   └── notification-manager.js   # 系统通知创建与管理（喝水 + 外卖）
│
├── services/
│   ├── storage-service.js         # 统一 storage.local 操作
│   ├── settings-service.js        # 用户设置读写
│   ├── water-service.js           # 饮水数据管理
│   └── stats-service.js           # 统计分析
│
├── utils/
│   ├── constants.js               # 全局常量（Alarm名、Key、默认值）
│   ├── date.js                    # 本地时区日期工具
│   └── browser-api.js             # 封装 Chrome/Firefox API
│
├── popup/
│   ├── popup.html                 # Popup 界面
│   ├── popup.css                  # Popup 样式
│   └── popup.js                   # Popup 逻辑
│
└── options/
    ├── options.html               # 设置页面
    ├── options.css                # 设置页样式
    └── options.js                 # 设置页逻辑
```

---

## 🚀 本地安装步骤

### Chrome / Edge / Brave

1. 打开浏览器，地址栏输入 `chrome://extensions`
2. 右上角开启「**开发者模式**」
3. 点击「**加载已解压的扩展程序**」
4. 选择 `Reminder_To_ Drink_Water` 文件夹（即包含 `manifest.json` 的目录）
5. 插件图标出现在工具栏，点击即可使用

### Firefox（兼容模式）

1. 地址栏输入 `about:debugging#/runtime/this-firefox`
2. 点击「**临时载入附加组件**」
3. 选择 `manifest.json` 文件

> **注意**：Firefox 临时加载的插件在浏览器关闭后会失效，生产使用需通过 Firefox Add-ons 商店发布

---

## ⚙️ 默认设置

| 设置项 | 默认值 |
|--------|--------|
| 每日饮水目标 | 2000 ml |
| 默认单次饮水量 | 250 ml |
| 提醒间隔 | 60 分钟 |
| 稍后提醒间隔 | 10 分钟 |
| 每日开始提醒 | 08:00 |
| 每日结束提醒 | 22:00 |
| 提醒星期 | 每天（周一～周日） |
| 系统通知 | 开启 |
| Badge 提醒 | 开启 |
| **喝水通知显示时长** | **30 秒** |
| **外卖提醒** | **开启** |
| **外卖提醒时间** | **11:20** |
| **外卖通知显示时长** | **5 分钟** |

---

## 🆕 新功能详解

### 🕐 通知自定义显示时长

喝水弹框不再固定几秒后消失，可在设置页「通知方式」区块自由调整显示时长：

- 范围：**1 秒 ~ 10 分钟**，共 20 个预设档位
- 默认值：**30 秒**
- 技术原理：使用 `requireInteraction: true` 阻止系统强制收起通知，再由 `setTimeout` 按用户设定时长精确关闭，彻底解决 Windows/Mac 系统在 5~20 秒内强制收走通知的问题

### 🍜 点外卖提醒

每日在指定时刻弹出外卖提醒通知，独立于喝水提醒运行：

| 配置项 | 说明 |
|--------|------|
| 启用/关闭 | Toggle 开关，默认**开启** |
| 提醒时间 | 支持 `00:00 ~ 23:59` 任意时刻，默认 **11:20** |
| 通知显示时长 | 1 秒 ~ 10 分钟，默认 **5 分钟** |

**通知内容**：
- 标题：🍜 该点外卖啦！
- 正文：午餐时间将到，记得提前点餐哦~ + 当前时间
- 按钮：「✅ 已点好了」 / 「🔔 再提醒我」

**技术实现**：
- 使用 `chrome.alarms` 的 `when`（精确时间戳）+ `periodInMinutes: 1440` 实现每日 24h 循环
- 若今天该时刻已过，自动顺延到明天同一时刻
- 设置页保存时直接操作 `chrome.alarms`，不依赖 Service Worker 是否在线

---

## 🧪 测试方案

### 测试 1：1分钟快速测试提醒

1. 打开插件设置页，将「提醒间隔」改为 `1 分钟`
2. 保存设置
3. 等待约 1 分钟，观察系统通知是否弹出
4. **预期**：出现标题「💧 该喝水啦！」的系统通知，包含两个按钮

### 测试 2：点击「我喝了」

1. 通知弹出后，点击「✅ 我喝了」按钮
2. 打开 Popup
3. **预期**：今日饮水量增加了 250ml（默认值），记录列表显示新记录

### 测试 3：点击「稍后提醒」

1. 通知弹出后，点击「⏰ 稍后提醒」
2. 等待 10 分钟（或临时改设置为 1 分钟测试）
3. **预期**：10 分钟后再次收到通知，标题为「💧 稍后提醒到了！」

### 测试 4：暂停提醒

1. 打开 Popup，点击「暂停」→ 选择「暂停 30 分钟」
2. 等待原来设置的间隔时间
3. **预期**：暂停期间不出现通知；Popup 显示「已暂停」状态及剩余时间

### 测试 5：浏览器关闭重启

1. 设置提醒间隔为 2 分钟
2. 完全关闭浏览器（不是休眠）
3. 重新启动浏览器
4. 等待约 2 分钟
5. **预期**：提醒正常恢复，通知如期弹出（`onStartup` 事件重建 Alarm）

### 测试 6：跨天数据隔离

1. 记录今天的饮水量
2. 将系统时间修改为第二天（或等到午夜）
3. 打开 Popup
4. **预期**：今日饮水量从 0ml 开始，之前的数据保留在历史中（以日期 key 区分）

> ⚠️ 本插件使用本地时区日期作为 key，不会因时区问题导致数据错乱

### 测试 7：达到每日目标

1. 设置每日目标为 500ml
2. 多次点击「+250ml」两次
3. **预期**：进度条变绿，Badge 显示 ✓，Toast 显示「🎉 恭喜达成今日目标！」

### 测试 8：防止重复通知

1. 手动快速触发两次（可通过 DevTools 调用 `chrome.alarms.onAlarm.dispatch`）
2. **预期**：通知 ID 固定，系统自动替换旧通知；30秒内的防重复保护跳过第二次

### 测试 9：修改提醒间隔

1. 将提醒间隔从 60 分钟改为 30 分钟并保存
2. 打开 DevTools → Extensions → Service Worker → 查看 `chrome.alarms.getAll()`
3. **预期**：旧 Alarm 被清除，新 Alarm 以 30 分钟间隔创建

### 测试 10：时间段限制

1. 设置「开始时间」为当前时间 + 1小时
2. 等待原来间隔的提醒触发
3. **预期**：Reminder Engine 判断不在时间范围内，跳过通知（Service Worker 日志可见）

### 测试 11：自定义通知显示时长 🆕

1. 进入设置页「通知方式」，将「通知显示时长」改为 `2 分钟`，保存
2. 等待喝水提醒弹出
3. **预期**：通知持续停留在屏幕上约 2 分钟后自动消失，不会在 5~20 秒内被系统收走

### 测试 12：点外卖提醒 🆕

1. 进入设置页「外卖提醒」，将提醒时间改为当前时间 + 2 分钟，保存
2. 等待触发时间到达
3. **预期**：弹出「🍜 该点外卖啦！」通知，包含「✅ 已点好了」和「🔔 再提醒我」按钮，按设定时长后自动关闭

### 测试 13：关闭外卖提醒 🆕

1. 进入设置页，关闭「启用外卖提醒」开关，保存
2. 查看 DevTools → `chrome.alarms.getAll()`
3. **预期**：`food_reminder_daily` Alarm 不存在；到点也不会弹出外卖通知

---

## 🔧 调试技巧

```
# 查看 Service Worker 日志
chrome://extensions → 找到插件 → 点击「Service Worker」→ 打开 DevTools Console

# 手动查看所有 Alarm（包括外卖提醒）
chrome.alarms.getAll(console.log)

# 手动查看存储数据
chrome.storage.local.get(null, console.log)

# 手动触发喝水 Alarm（测试用）
chrome.alarms.create('water_reminder_main', { delayInMinutes: 0.1 })

# 手动触发外卖 Alarm（测试用）
chrome.alarms.create('food_reminder_daily', { delayInMinutes: 0.1 })
```

---

## 🔒 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 存储用户设置和饮水记录到本地 |
| `alarms` | 后台定时触发喝水提醒及外卖提醒 |
| `notifications` | 显示系统通知 |

**不使用以下权限**：`tabs`、`history`、`cookies`、`webRequest`、`<all_urls>`

---

## 📦 技术架构

- **MV3 Service Worker**：无状态设计，所有状态持久化到 `chrome.storage.local`
- **chrome.alarms**：唯一后台定时方案，浏览器重启后自动恢复
  - 喝水提醒：`periodInMinutes` 循环间隔
  - 外卖提醒：`when`（精确时间戳）+ `periodInMinutes: 1440`（每日循环）
- **requireInteraction: true**：阻止 Windows/Mac 系统强制收起通知，配合 `setTimeout` 实现精确自定义显示时长
- **ES Modules**：所有文件使用 `import/export`，无打包工具依赖
- **本地时区日期**：使用 `toLocaleDateString('zh-CA')` 获取 YYYY-MM-DD，避免 UTC 偏移
- **防重复通知**：固定 Notification ID + 最小间隔保护

---

## 📝 版本历史

### v1.2.0（2026-09-14）
- 🆕 新增「点外卖提醒」功能：每日定时提醒，时间可自定义（00:00 ~ 23:59），独立通知时长设置
- 🆕 新增「通知自定义显示时长」：喝水通知显示时长支持 1 秒 ~ 10 分钟自由选择
- 🐛 修复通知被系统强制在 5~20 秒内收走的问题（改用 `requireInteraction: true`）

### v1.0.0（2026-09-10）
- 初始版本发布
- 支持自定义提醒间隔、每日目标、时间段、星期
- 暂停、稍后提醒功能
- 完整的饮水历史记录

---

*数据仅存储在您的浏览器本地，不上传任何服务器。*


---

## ✨ 功能特性

- **智能提醒**：使用 `chrome.alarms` 后台定时，浏览器重启后自动恢复，不依赖 setInterval
- **灵活设置**：提醒间隔支持 20/30/45/60/90/120 分钟或自定义
- **每日目标**：设置每日饮水目标（默认 2000ml），实时显示完成进度
- **精细控制**：可设置提醒时间段、提醒星期（工作日/周末）
- **暂停功能**：支持暂停 30 分钟、1 小时、2 小时、今天不再提醒
- **稍后提醒**：通知中点击"稍后提醒"，10 分钟后再次提醒
- **本地数据**：所有数据按日期存储在本地，跨天自动新建记录，保留历史
- **隐私安全**：仅申请 `storage`、`alarms`、`notifications` 权限，不读取网页内容

---

## 📁 项目目录结构

```
Reminder_To_Drink_Water/
├── manifest.json                  # 插件清单文件（MV3）
├── README.md                      # 本文档
│
├── assets/
│   └── icons/
│       ├── icon16.png             # 16×16 图标
│       ├── icon32.png             # 32×32 图标
│       ├── icon48.png             # 48×48 图标
│       └── icon128.png            # 128×128 图标
│
├── background/
│   ├── service-worker.js          # SW 入口：事件监听、消息路由
│   ├── alarm-manager.js           # Alarm 生命周期管理
│   ├── reminder-engine.js         # 判断是否应该提醒
│   └── notification-manager.js   # 系统通知创建与管理
│
├── services/
│   ├── storage-service.js         # 统一 storage.local 操作
│   ├── settings-service.js        # 用户设置读写
│   ├── water-service.js           # 饮水数据管理
│   └── stats-service.js           # 统计分析
│
├── utils/
│   ├── constants.js               # 全局常量（Alarm名、Key、默认值）
│   ├── date.js                    # 本地时区日期工具
│   └── browser-api.js             # 封装 Chrome/Firefox API
│
├── popup/
│   ├── popup.html                 # Popup 界面
│   ├── popup.css                  # Popup 样式
│   └── popup.js                   # Popup 逻辑
│
└── options/
    ├── options.html               # 设置页面
    ├── options.css                # 设置页样式
    └── options.js                 # 设置页逻辑
```

---

## 🚀 本地安装步骤

### Chrome / Edge / Brave

1. 打开浏览器，地址栏输入 `chrome://extensions`
2. 右上角开启「**开发者模式**」
3. 点击「**加载已解压的扩展程序**」
4. 选择 `Reminder_To_ Drink_Water` 文件夹（即包含 `manifest.json` 的目录）
5. 插件图标出现在工具栏，点击即可使用

### Firefox（兼容模式）

1. 地址栏输入 `about:debugging#/runtime/this-firefox`
2. 点击「**临时载入附加组件**」
3. 选择 `manifest.json` 文件

> **注意**：Firefox 临时加载的插件在浏览器关闭后会失效，生产使用需通过 Firefox Add-ons 商店发布

---

## ⚙️ 默认设置

| 设置项 | 默认值 |
|--------|--------|
| 每日饮水目标 | 2000 ml |
| 默认单次饮水量 | 250 ml |
| 提醒间隔 | 60 分钟 |
| 稍后提醒间隔 | 10 分钟 |
| 每日开始提醒 | 08:00 |
| 每日结束提醒 | 22:00 |
| 提醒星期 | 每天（周一～周日） |
| 系统通知 | 开启 |
| Badge 提醒 | 开启 |

---

## 🧪 测试方案

### 测试 1：1分钟快速测试提醒

1. 打开插件设置页，将「提醒间隔」改为 `1 分钟`（在下拉框选「自定义」→ 输入 `1`）
2. 保存设置
3. 等待约 1 分钟，观察系统通知是否弹出
4. **预期**：出现标题「💧 该喝水啦！」的系统通知，包含两个按钮

### 测试 2：点击"我喝了"

1. 通知弹出后，点击「✅ 我喝了」按钮
2. 打开 Popup
3. **预期**：今日饮水量增加了 250ml（默认值），记录列表显示新记录

### 测试 3：点击"稍后提醒"

1. 通知弹出后，点击「⏰ 稍后提醒」
2. 等待 10 分钟（或临时改设置为 1 分钟测试）
3. **预期**：10 分钟后再次收到通知，标题为「💧 稍后提醒到了，别忘记喝水！」

### 测试 4：暂停提醒

1. 打开 Popup，点击「暂停」→ 选择「暂停 30 分钟」
2. 等待原来设置的间隔时间
3. **预期**：暂停期间不出现通知；Popup 显示「已暂停」状态及剩余时间

### 测试 5：浏览器关闭重启

1. 设置提醒间隔为 2 分钟
2. 完全关闭浏览器（不是休眠）
3. 重新启动浏览器
4. 等待约 2 分钟
5. **预期**：提醒正常恢复，通知如期弹出（`onStartup` 事件重建 Alarm）

### 测试 6：跨天数据隔离

1. 记录今天的饮水量
2. 将系统时间修改为第二天（或等到午夜）
3. 打开 Popup
4. **预期**：今日饮水量从 0ml 开始，之前的数据保留在历史中（以日期 key 区分）

> ⚠️ 本插件使用本地时区日期作为 key，不会因时区问题导致数据错乱

### 测试 7：达到每日目标

1. 设置每日目标为 500ml
2. 多次点击「+250ml」两次
3. **预期**：进度条变绿，Badge 显示 ✓，Toast 显示「🎉 恭喜达成今日目标！」

### 测试 8：防止重复通知

1. 手动快速触发两次（可通过 DevTools 调用 `chrome.alarms.onAlarm.dispatch`）
2. **预期**：通知 ID 固定，系统自动替换旧通知；30秒内的防重复保护跳过第二次

### 测试 9：修改提醒间隔

1. 将提醒间隔从 60 分钟改为 30 分钟并保存
2. 打开 DevTools → Extensions → Service Worker → 查看 `chrome.alarms.getAll()`
3. **预期**：旧 Alarm 被清除，新 Alarm 以 30 分钟间隔创建

### 测试 10：时间段限制

1. 设置「开始时间」为当前时间 + 1小时
2. 等待原来间隔的提醒触发
3. **预期**：Reminder Engine 判断不在时间范围内，跳过通知（Service Worker 日志可见）

---

## 🔧 调试技巧

```
# 查看 Service Worker 日志
chrome://extensions → 找到插件 → 点击「Service Worker」→ 打开 DevTools Console

# 手动查看 Alarm
chrome.alarms.getAll(console.log)

# 手动查看存储数据
chrome.storage.local.get(null, console.log)

# 手动触发 Alarm（测试用）
chrome.alarms.create('water_reminder_main', { delayInMinutes: 0.1 })
```

---

## 🔒 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 存储用户设置和饮水记录到本地 |
| `alarms` | 后台定时触发喝水提醒 |
| `notifications` | 显示系统通知 |

**不使用以下权限**：`tabs`、`history`、`cookies`、`webRequest`、`<all_urls>`

---

## 📦 技术架构

- **MV3 Service Worker**：无状态设计，所有状态持久化到 `chrome.storage.local`
- **chrome.alarms**：唯一后台定时方案，浏览器重启后自动恢复
- **ES Modules**：所有文件使用 `import/export`，无打包工具依赖
- **本地时区日期**：使用 `toLocaleDateString('zh-CA')` 获取 YYYY-MM-DD，避免 UTC 偏移
- **防重复通知**：固定 Notification ID + 最小间隔保护

---

## 📝 版本历史

### v1.0.0（2026-09-10）
- 初始版本发布
- 支持自定义提醒间隔、每日目标、时间段、星期
- 暂停、稍后提醒功能
- 完整的饮水历史记录

---

*数据仅存储在您的浏览器本地，不上传任何服务器。*
