const express = require("express");
const app = express();
const axios = require("axios");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { execSync } = require("child_process");
const exec = promisify(require("child_process").exec);

// 环境变量
const FILE_PATH = process.env.FILE_PATH || "./tmp";
const SUB_PATH = process.env.SUB_PATH || "sub";
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
const UUID = process.env.UUID || "9afd1229-b893-40c1-84dd-51e7ce204913";
const NEZHA_SERVER = process.env.NEZHA_SERVER || "";
const NEZHA_PORT = process.env.NEZHA_PORT || "";
const NEZHA_KEY = process.env.NEZHA_KEY || "";
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || "";
const ARGO_AUTH = process.env.ARGO_AUTH || "";
const ARGO_PORT = process.env.ARGO_PORT || 8080;
const CFIP = process.env.CFIP || "www.visa.com.sg";
const CFPORT = process.env.CFPORT || 443;
const NAME = process.env.NAME || "Appwrite";

// 初始化目录
if (!fs.existsSync(FILE_PATH)) fs.mkdirSync(FILE_PATH);
let npmPath = path.join(FILE_PATH, "npm");
let phpPath = path.join(FILE_PATH, "php");
let webPath = path.join(FILE_PATH, "web");
let botPath = path.join(FILE_PATH, "bot");
let subPath = path.join(FILE_PATH, "sub.txt");
let configPath = path.join(FILE_PATH, "config.json");
let bootLogPath = path.join(FILE_PATH, "boot.log");

// 清理旧文件
function cleanupOldFiles() {
  ["web", "bot", "npm", "php", "sub.txt", "boot.log"].forEach((file) => {
    const filePath = path.join(FILE_PATH, file);
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
  });
}

// HTTP 基础路由
app.get("/", function (req, res) {
  res.send("Hello world!");
});

// V2Ray 配置写入
const config = {
  log: { access: "/dev/null", error: "/dev/null", loglevel: "none" },
  inbounds: [
    {
      port: ARGO_PORT,
      protocol: "vless",
      settings: {
        clients: [{ id: UUID, flow: "xtls-rprx-vision" }],
        decryption: "none",
        fallbacks: [
          { dest: 3001 },
          { path: "/vless-argo", dest: 3002 },
          { path: "/vmess-argo", dest: 3003 },
          { path: "/trojan-argo", dest: 3004 },
        ],
      },
      streamSettings: { network: "tcp" },
    },
    {
      port: 3001,
      listen: "127.0.0.1",
      protocol: "vless",
      settings: { clients: [{ id: UUID }], decryption: "none" },
      streamSettings: { network: "tcp", security: "none" },
    },
    {
      port: 3002,
      listen: "127.0.0.1",
      protocol: "vless",
      settings: { clients: [{ id: UUID }], decryption: "none" },
      streamSettings: {
        network: "ws",
        wsSettings: { path: "/vless-argo" },
      },
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
        metadataOnly: false,
      },
    },
    {
      port: 3003,
      listen: "127.0.0.1",
      protocol: "vmess",
      settings: { clients: [{ id: UUID, alterId: 0 }] },
      streamSettings: {
        network: "ws",
        wsSettings: { path: "/vmess-argo" },
      },
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
        metadataOnly: false,
      },
    },
    {
      port: 3004,
      listen: "127.0.0.1",
      protocol: "trojan",
      settings: { clients: [{ password: UUID }] },
      streamSettings: {
        network: "ws",
        wsSettings: { path: "/trojan-argo" },
      },
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
        metadataOnly: false,
      },
    },
  ],
  dns: { servers: ["https+local://8.8.8.8/dns-query"] },
  outbounds: [
    { protocol: "freedom", tag: "direct" },
    { protocol: "blackhole", tag: "block" },
  ],
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

// 判断架构
function getSystemArchitecture() {
  const arch = os.arch();
  return ["arm", "arm64", "aarch64"].includes(arch) ? "arm" : "amd";
}

// 下载列表
function getFilesForArchitecture(arch) {
  let base = arch === "arm"
    ? [
        { fileName: "web", fileUrl: "https://arm64.ssss.nyc.mn/web" },
        { fileName: "bot", fileUrl: "https://arm64.ssss.nyc.mn/2go" },
      ]
    : [
        { fileName: "web", fileUrl: "https://amd64.ssss.nyc.mn/web" },
        { fileName: "bot", fileUrl: "https://amd64.ssss.nyc.mn/2go" },
      ];

  if (NEZHA_SERVER && NEZHA_KEY) {
    base.unshift({
      fileName: NEZHA_PORT ? "npm" : "php",
      fileUrl: arch === "arm"
        ? (NEZHA_PORT ? "https://arm64.ssss.nyc.mn/agent" : "https://arm64.ssss.nyc.mn/v1")
        : (NEZHA_PORT ? "https://amd64.ssss.nyc.mn/agent" : "https://amd64.ssss.nyc.mn/v1"),
    });
  }
  return base;
}

// 文件下载器（修复版）
function downloadFile(fileName, fileUrl) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(FILE_PATH, fileName);
    const writer = fs.createWriteStream(filePath);
    axios({
      method: "get",
      url: fileUrl,
      timeout: 15000,
      responseType: "stream",
    })
      .then((response) => {
        response.data.pipe(writer);
        writer.on("finish", () => {
          console.log(`✅ 下载成功：${fileUrl}`);
          resolve(fileName);
        });
        writer.on("error", (err) => reject(err));
      })
      .catch((err) => {
        console.error(`❌ 下载失败：${fileUrl}`, err.message || err);
        reject(err);
      });
  });
}

// 下载文件并运行服务
async function downloadFilesAndRun() {
  const arch = getSystemArchitecture();
  const files = getFilesForArchitecture(arch);
  await Promise.all(files.map((f) => downloadFile(f.fileName, f.fileUrl)));

  for (const f of files) {
    const fullPath = path.join(FILE_PATH, f.fileName);
    if (fs.existsSync(fullPath)) fs.chmodSync(fullPath, 0o775);
  }

  if (NEZHA_SERVER && NEZHA_KEY) {
    if (!NEZHA_PORT) {
      const port = NEZHA_SERVER.split(":").pop();
      const tls = ["443", "8443", "2096", "2087", "2083", "2053"].includes(port) ? "true" : "false";
      const yaml = `client_secret: ${NEZHA_KEY}\ntls: ${tls}\nserver: ${NEZHA_SERVER}\nuuid: ${UUID}`;
      fs.writeFileSync(path.join(FILE_PATH, "config.yaml"), yaml);
      await exec(`nohup ${phpPath} -c "${path.join(FILE_PATH, "config.yaml")}" >/dev/null 2>&1 &`);
    } else {
      const tls = ["443", "8443", "2096", "2087", "2083", "2053"].includes(NEZHA_PORT) ? "--tls" : "";
      await exec(`nohup ${npmPath} -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${tls} >/dev/null 2>&1 &`);
    }
  }

  await exec(`nohup ${webPath} -c ${configPath} > ${FILE_PATH}/web.log 2>&1 &`);

  let args = ARGO_AUTH.match(/^TunnelSecret/)
    ? `tunnel --config ${FILE_PATH}/tunnel.yml run`
    : ARGO_AUTH.match(/^[A-Za-z0-9=]{120,250}$/)
    ? `tunnel run --token ${ARGO_AUTH}`
    : `tunnel --url http://localhost:${ARGO_PORT}`;

  await exec(`nohup ${botPath} ${args} > ${bootLogPath} 2>&1 &`);
}

// Argo 配置生成
function argoType() {
  if (ARGO_AUTH.includes("TunnelSecret")) {
    fs.writeFileSync(path.join(FILE_PATH, "tunnel.json"), ARGO_AUTH);
    fs.writeFileSync(path.join(FILE_PATH, "tunnel.yml"), `
tunnel: ${ARGO_AUTH.split('"')[11]}
credentials-file: ${path.join(FILE_PATH, "tunnel.json")}
ingress:
  - hostname: ${ARGO_DOMAIN}
    service: http://localhost:${ARGO_PORT}
  - service: http_status:404`);
  }
}
argoType();

// 订阅地址
let lastSubTxt = "";
app.get(`/${SUB_PATH}`, (req, res) => {
  if (!lastSubTxt) return res.status(503).send("⚠️ 节点未就绪，请稍后刷新订阅");
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send(Buffer.from(lastSubTxt).toString("base64"));
});

// 提取 Argo 域名并构造订阅
async function extractDomains() {
  if (!fs.existsSync(bootLogPath)) return;
  const log = fs.readFileSync(bootLogPath, "utf-8");
  const match = log.match(/https?:\/\/([^ ]*trycloudflare\.com)/);
  const argoDomain = match ? match[1] : ARGO_DOMAIN;
  if (!argoDomain) return console.log("⚠️ 未获取到 Argo 域名");

  const VMESS = {
    v: "2",
    ps: `${NAME}`,
    add: CFIP,
    port: CFPORT,
    id: UUID,
    aid: "0",
    scy: "none",
    net: "ws",
    type: "none",
    host: argoDomain,
    path: "/vmess-argo?ed=2560",
    tls: "tls",
    sni: argoDomain,
  };

  const subTxt = `
vless://${UUID}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${argoDomain}&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${NAME}
vmess://${Buffer.from(JSON.stringify(VMESS)).toString("base64")}
trojan://${UUID}@${CFIP}:${CFPORT}?security=tls&sni=${argoDomain}&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${NAME}`;

  lastSubTxt = subTxt;
  fs.writeFileSync(subPath, Buffer.from(subTxt).toString("base64"));
}

// 定时清理临时文件
function cleanFiles() {
  setTimeout(() => {
    exec(`rm -rf ${bootLogPath} ${configPath} ${webPath} ${botPath} ${phpPath} ${npmPath}`, () => {
      console.clear();
      console.log("🧹 清理完成，App继续运行中...");
    });
  }, 90000);
}

// 主入口
async function startserver() {
  try {
    cleanupOldFiles();
    await downloadFilesAndRun();
    await extractDomains();
    cleanFiles();
    app._router.stack.forEach((r) => r.route && console.log("✅ 路由注册:", r.route.path));
  } catch (err) {
    console.error("❌ 启动异常:", err.message || err);
  }
}
startserver();

app.listen(PORT, () => console.log(`🚀 服务运行中，端口: ${PORT}`));