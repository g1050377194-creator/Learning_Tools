"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingBlock, PageHeader } from "@/components/panels";
import { useStudy } from "@/components/study-provider";
import { useModels } from "@/components/use-models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  PROVIDERS,
  deleteModel,
  maskKey,
  providerPreset,
  saveModel,
  setActiveModel,
  type ProviderId,
} from "@/lib/models";
import { percent } from "@/lib/format";
import { setRetention } from "@/lib/study";
import { uid } from "@/lib/text";

export default function SettingsPage() {
  const data = useStudy();
  const models = useModels();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [provider, setProvider] = useState<ProviderId>("deepseek");
  const [baseUrl, setBaseUrl] = useState<string>(providerPreset("deepseek").baseUrl);
  const [model, setModel] = useState<string>(providerPreset("deepseek").model);
  const [apiKey, setApiKey] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    document.title = "设置 · 循迹";
  }, []);

  function resetForm() {
    setEditingId(null);
    setDisplayName("");
    setProvider("deepseek");
    setBaseUrl(providerPreset("deepseek").baseUrl);
    setModel(providerPreset("deepseek").model);
    setApiKey("");
    setFormError("");
  }

  function onProvider(next: ProviderId) {
    const preset = providerPreset(next);
    setProvider(next);
    setBaseUrl(preset.baseUrl);
    if (preset.model) setModel(preset.model);
  }

  function onSave() {
    if (!displayName.trim() || !model.trim() || !baseUrl.trim()) {
      setFormError("显示名称、模型名称和地址都要填。");
      return;
    }
    const previous = models.models.find((item) => item.id === editingId);
    const key = apiKey.trim() || previous?.apiKey || "";
    if (!key) {
      setFormError("密钥要填一次。它只写在这台浏览器的 localStorage 里。");
      return;
    }
    saveModel({
      id: editingId ?? uid(),
      displayName: displayName.trim(),
      provider,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      apiKey: key,
    });
    toast.success(editingId ? "模型已更新" : "模型已保存，并设为当前");
    resetForm();
  }

  if (!data) return <LoadingBlock label="正在读取设置" />;

  const retentionPercent = Math.round(data.retention * 100);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="设置"
        title="模型和记忆保持率"
        description="可以存多套模型，全局只用当前这一套。不填密钥也能学：路线、阅读和写作反馈会走离线规则。"
      />

      <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-xl">密钥放在哪里</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          密钥保存在这台浏览器的 localStorage，牌组和复习记录在 IndexedDB。循迹自己的服务器不保存密钥，也不会把密钥写进日志。你点生成、阅读或获取反馈时，浏览器把密钥连同内容发给本机的 <code>/api/ai</code>，由它转发到你填的服务商，用完即弃。
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          OpenAI、DeepSeek 和自定义兼容接口会请求 <code>{`{地址}/chat/completions`}</code>。Anthropic 请求 <code>{`{地址}/messages`}</code>。Gemini 请求 <code>{`{地址}/models/{模型}:generateContent`}</code>。地址填到版本前缀即可，例如 <code>https://api.openai.com/v1</code>。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl">已保存的模型</h2>
        {models.models.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">还没有模型。下面添加一套之后，生成路线和阅读就会改走它。现在仍是离线模式。</p>
        ) : (
          <ul className="space-y-2">
            {models.models.map((item) => {
              const active = item.id === models.activeId;
              return (
                <li key={item.id} className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.displayName}</p>
                      {active ? <Badge>当前</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {providerPreset(item.provider).label} · {item.model} · {maskKey(item.apiKey)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!active ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => setActiveModel(item.id)}>
                        设为当前
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(item.id);
                        setDisplayName(item.displayName);
                        setProvider(item.provider);
                        setBaseUrl(item.baseUrl);
                        setModel(item.model);
                        setApiKey("");
                        setFormError("");
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        deleteModel(item.id);
                        if (editingId === item.id) resetForm();
                        toast.success("已删除这个模型配置");
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form
        className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <h2 className="text-xl md:col-span-2">{editingId ? "编辑模型" : "添加模型"}</h2>
        <div className="space-y-2">
          <Label htmlFor="display-name">显示名称</Label>
          <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：家里的 DeepSeek" />
        </div>
        <div className="space-y-2">
          <Label>服务商</Label>
          <Select
            value={provider}
            onValueChange={(value) => value && onProvider(value as ProviderId)}
            items={PROVIDERS.map((item) => ({ value: item.id, label: item.label }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="base-url">接口地址</Label>
          <Input id="base-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model-name">模型名称</Label>
          <Input id="model-name" value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如 deepseek-chat" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="api-key">API 密钥</Label>
          <Input
            id="api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={editingId ? "留空则保持原密钥" : "只保存在这台浏览器"}
          />
        </div>
        {formError ? <p className="text-sm text-destructive md:col-span-2">{formError}</p> : null}
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit">{editingId ? "保存修改" : "保存并设为当前"}</Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              取消编辑
            </Button>
          ) : null}
        </div>
      </form>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl">期望保持率</h2>
          <p className="font-heading text-2xl tabular-nums">{percent(data.retention)}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          默认 90%。之后的 Again / Hard / Good / Easy 会按这个比例计算间隔，已经排好的到期日不会自动重排。
        </p>
        <Slider
          className="mt-5"
          min={70}
          max={97}
          step={1}
          value={[retentionPercent]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value;
            if (typeof next === "number") void setRetention(next / 100);
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">可调范围 70% 到 97%。</p>
      </section>
    </div>
  );
}
