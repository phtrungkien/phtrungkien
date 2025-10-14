const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const HISTORY_PATH = path.join(__dirname, "cache", "fflike_his.json");

module.exports.config = {
 name: "fflike",
 version: "1.0.0",
 hasPermssion: 0,
 credits: "Phạm Trung Kiên",
 description: "Buff like Free Fire",
 commandCategory: "Tiện ích",
 usages: "fflike [UID] | fflike his",
 cooldowns: 5
};

// gọi api
async function callFFLike(uid) {
 const url = `https://ag-team-like-api.vercel.app/like?uid=${encodeURIComponent(uid)}`;
 const res = await axios.get(url, { timeout: 15000 });
 return res.data;
}

// lưu lịch sử
async function saveHistory(record) {
 await fs.ensureDir(path.dirname(HISTORY_PATH));
 let list = [];
 if (await fs.pathExists(HISTORY_PATH)) {
 try {
 list = JSON.parse(await fs.readFile(HISTORY_PATH, "utf8")) || [];
 } catch {}
 }
 list.unshift(record);
 list = list.slice(0, 50);
 await fs.writeFile(HISTORY_PATH, JSON.stringify(list, null, 2));
}

async function readHistory() {
 if (!(await fs.pathExists(HISTORY_PATH))) return [];
 try {
 return JSON.parse(await fs.readFile(HISTORY_PATH, "utf8")) || [];
 } catch {
 return [];
 }
}


function formatResult(d) {
 const ok = Number(d?.status) === 1;
 const lines = [];

 lines.push(ok ? "✅ Buff thành công!" : "⚠️ Buff không thành công!");
 lines.push("━━━━━━━━━━━━━━━━━━━━━");
 lines.push(`👤 Tên game: ${d?.PlayerNickname ?? "Không rõ"}`);
 lines.push(`🆔 ID: ${d?.UID ?? "-"}`);
 lines.push("─────────────────────");
 lines.push(`👍 Like ban đầu: ${d?.LikesBefore ?? "?"}`);
 lines.push(`❤️ Like hiện tại: ${d?.LikesAfter ?? "?"}`);
 lines.push(`➕ Like được buff: +${d?.LikesGivenByAPI ?? "?"}`);
 lines.push("━━━━━━━━━━━━━━━━━━━━━");
 lines.push(`📦 Trạng thái: ${ok ? "✅ Thành công" : "❌ thất bại"}`);
 const now = new Date();
 lines.push(`🕒 Thời gian: ${now.toLocaleString("vi-VN")}`);
 lines.push(`⛔ Lưu ý: mỗi ngày chỉ được buff 1 lần/1 ID`);

 return lines.join("\n");
}


function isValidUID(uid) {
 return /^\d{5,20}$/.test(String(uid || "").trim());
}


module.exports.run = async function ({ api, event, args }) {
 const { threadID, messageID, senderID } = event;
 const sub = (args[0] || "").toLowerCase().trim();

 if (!sub) {
 return api.sendMessage(
 '📋 Hướng dẫn "fflike":\n\n' +
 '• fflike <UID> → buff ngay theo UID\n' +
 '• fflike his → xem lịch sử 10 lần gần nhất\n\n' +
 '👉 Hoặc reply UID để buff.',
 threadID,
 (err, info) => {
 if (err) return;
 global.client.handleReply.push({
 name: module.exports.config.name,
 messageID: info.messageID,
 author: senderID,
 type: "enterUID"
 });
 }
 );
 }

 // xem lịch sử
 if (sub === "his") {
 try {
 const list = (await readHistory()).slice(0, 10);
 if (list.length === 0)
 return api.sendMessage("❌ Chưa có lịch sử buff.", threadID, messageID);
 const txt = list
 .map((r, i) => {
 const when = new Date(r.time).toLocaleString("vi-VN");
 const ok = r.status === 1 ? "✅" : "⚠️";
 return `${i + 1}. ${ok} UID ${r.UID} | ${r.PlayerNickname} | ${r.LikesBefore}➜${r.LikesAfter} (+${r.LikesGivenByAPI}) | ${when}`;
 })
 .join("\n");
 return api.sendMessage("📦 Lịch sử buff gần đây:\n\n" + txt, threadID, messageID);
 } catch (e) {
 return api.sendMessage(`❌ Lỗi đọc lịch sử: ${e.message}`, threadID, messageID);
 }
 }

 // buff trực tiếp
 if (isValidUID(sub)) {
 try {
 const data = await callFFLike(sub);
 const msg = formatResult(data);
 await saveHistory({ time: Date.now(), ...(data || {}) });
 return api.sendMessage(msg, threadID, messageID);
 } catch (e) {
 return api.sendMessage(`❌ Lỗi gọi API: ${e.message}`, threadID, messageID);
 }
 }

 // nếu nhập sai UID
 return api.sendMessage(
 "⚠️ UID không hợp lệ. Vui lòng nhập UID hợp lệ (chỉ số, 5-20 ký tự).",
 threadID,
 (err, info) => {
 if (err) return;
 global.client.handleReply.push({
 name: module.exports.config.name,
 messageID: info.messageID,
 author: senderID,
 type: "enterUID"
 });
 }
 );
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
 const { threadID, messageID, senderID, body } = event;
 if (senderID !== handleReply.author) return;

 switch (handleReply.type) {
 case "enterUID": {
 const uid = String(body || "").trim();
 if (!isValidUID(uid))
 return api.sendMessage("⚠️ UID không hợp lệ. Hãy nhập lại UID số (5-20 ký tự).", threadID, messageID);

 try {
 const data = await callFFLike(uid);
 const msg = formatResult(data);
 await saveHistory({ time: Date.now(), ...(data || {}) });
 return api.sendMessage(msg, threadID, messageID);
 } catch (e) {
 return api.sendMessage(`❌ Lỗi gọi API: ${e.message}`, threadID, messageID);
 }
 }
 }
};