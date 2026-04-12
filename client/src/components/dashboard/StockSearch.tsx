import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, TrendingUp, TrendingDown, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TwseStockQuote } from "@shared/schema";

const spring = { type: "spring" as const, damping: 30, stiffness: 200 };

interface TwseResult {
  quote: TwseStockQuote;
  institutional: {
    date: string;
    foreignNet: number;
    trustNet: number;
    dealerNet: number;
    totalNet: number;
  } | null;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatValue(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)} 億`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} 萬`;
  return v.toLocaleString();
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function InstitutionalRow({ label, net }: { label: string; net: number }) {
  const isUp = net >= 0;
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className={`text-[10px] font-bold tabular-nums ${isUp ? "text-emerald-500" : "text-red-500"}`}>
        {isUp ? "+" : ""}{net.toLocaleString()}
      </span>
    </div>
  );
}

export function StockSearch() {
  const [inputValue, setInputValue] = useState("");
  const [searchTicker, setSearchTicker] = useState("");

  const { data, isFetching, isError, error } = useQuery<TwseResult>({
    queryKey: ["/api/twse", searchTicker],
    queryFn: async () => {
      const res = await fetch(`/api/twse/${searchTicker}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    enabled: !!searchTicker,
    staleTime: 60_000,
    retry: false,
  });

  const handleSearch = () => {
    const t = inputValue.trim().replace(/\s/g, "");
    if (/^\d{4,6}$/.test(t)) setSearchTicker(t);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClear = () => {
    setInputValue("");
    setSearchTicker("");
  };

  const q = data?.quote;
  const inst = data?.institutional;
  const isUp = q ? q.change >= 0 : true;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Search className="w-3.5 h-3.5 text-primary" />
        <h2 className="text-xs font-bold">個股查詢 (TWSE 即時)</h2>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入股票代碼，例如 2330"
            className="pr-8 h-8 text-sm"
          />
          {inputValue && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <Button size="sm" onClick={handleSearch} disabled={isFetching} className="h-8 gap-1.5">
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          查詢
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring}
            className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {(error as Error)?.message ?? "查詢失敗，請確認股票代碼是否正確"}
          </motion.div>
        )}

        {q && !isError && (
          <motion.div
            key={q.ticker}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring}
            className="mt-3"
          >
            <Card className="p-4 relative overflow-hidden border-border/60">
              <div className={`absolute top-0 left-0 right-0 h-[2px] ${isUp ? "bg-emerald-500" : "bg-red-500"}`} />

              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {q.ticker}
                    </span>
                    <span className="font-semibold">{q.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    TWSE 上市 · 資料日期：{q.date}
                  </p>
                </div>
                {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold tabular-nums">{q.close.toLocaleString()}</span>
                <div className={`flex items-center gap-1 ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                  {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-semibold tabular-nums">
                    {isUp ? "+" : ""}{q.change.toFixed(2)} ({isUp ? "+" : ""}{q.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* OHLCV Grid */}
              <div className="grid grid-cols-4 gap-2 mb-3 p-2 bg-muted/30 rounded-lg border border-border/40">
                <MetaItem label="開盤" value={q.open.toLocaleString()} />
                <MetaItem label="最高" value={q.high.toLocaleString()} />
                <MetaItem label="最低" value={q.low.toLocaleString()} />
                <MetaItem label="成交量" value={formatVolume(q.volume)} />
              </div>

              {/* Price Range Bar */}
              {q.high > q.low && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
                  <span className="tabular-nums">{q.low}</span>
                  <div className="flex-1 h-1.5 bg-muted/50 rounded-full relative overflow-hidden">
                    <div
                      className={`absolute h-full rounded-full ${isUp ? "bg-emerald-500/60" : "bg-red-500/60"}`}
                      style={{ width: `${((q.close - q.low) / (q.high - q.low)) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums">{q.high}</span>
                  <span className="text-muted-foreground/60">今日區間</span>
                </div>
              )}

              {/* Fundamentals */}
              {(q.pe || q.pb || q.dividendYield) && (
                <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-muted/20 rounded-lg border border-border/40">
                  <MetaItem label="本益比 P/E" value={q.pe != null ? q.pe.toFixed(2) : "--"} />
                  <MetaItem label="股價淨值比 P/B" value={q.pb != null ? q.pb.toFixed(2) : "--"} />
                  <MetaItem label="殖利率" value={q.dividendYield != null ? `${q.dividendYield.toFixed(2)}%` : "--"} />
                </div>
              )}

              {/* Institutional */}
              {inst && (
                <div>
                  <p className="text-[9px] text-muted-foreground mb-1.5">
                    法人買賣超（{inst.date}）
                  </p>
                  <div className="grid grid-cols-4 gap-2 p-2 bg-muted/30 rounded-lg border border-border/40">
                    <InstitutionalRow label="外資" net={inst.foreignNet} />
                    <InstitutionalRow label="投信" net={inst.trustNet} />
                    <InstitutionalRow label="自營商" net={inst.dealerNet} />
                    <InstitutionalRow label="合計" net={inst.totalNet} />
                  </div>
                </div>
              )}

              {/* Footer */}
              <p className="text-[9px] text-muted-foreground mt-2">
                成交值 {formatValue(q.value)} · 成交筆數 {q.transactions.toLocaleString()} 筆 · 資料來源：TWSE OpenAPI
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
