import { Rating, State } from "ts-fsrs";

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function startOfDay(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfDay(now = new Date()) {
  const date = new Date(now);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 5) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function formatToday(now = new Date()) {
  return `${now.getMonth() + 1}月${now.getDate()}日 · ${WEEKDAYS[now.getDay()]}`;
}

export function formatDateTime(ts: number) {
  const date = new Date(ts);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDue(ts: number, now = Date.now()) {
  if (ts <= now + 30_000) return "现在";
  const date = new Date(ts);
  const today = new Date(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = isSameDay(date, today);
  const isTomorrow = isSameDay(date, tomorrow);
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (sameDay) return `今天 ${hm}`;
  if (isTomorrow) return `明天 ${hm}`;
  if (date.getFullYear() === today.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatInterval(fromMs: number, toMs: number) {
  const minutes = Math.max(0, Math.round((toMs - fromMs) / 60_000));
  if (minutes < 1) return "不到 1 分钟";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} 个月`;
  return `${Math.max(1, Math.round(months / 12))} 年`;
}

export function stateLabel(state: number) {
  switch (state) {
    case State.New:
      return "新卡";
    case State.Learning:
      return "学习中";
    case State.Review:
      return "复习";
    case State.Relearning:
      return "重学";
    default:
      return "卡片";
  }
}

export function ratingLabel(rating: number) {
  switch (rating) {
    case Rating.Again:
      return "重来";
    case Rating.Hard:
      return "困难";
    case Rating.Good:
      return "良好";
    case Rating.Easy:
      return "简单";
    default:
      return "评分";
  }
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
