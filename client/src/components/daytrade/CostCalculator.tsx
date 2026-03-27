import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, Info, InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function CostCalculator() {
  const [price, setPrice] = useState<number>(100);
  const [shares, setShares] = useState<number>(1000);
  const [discount, setDiscount] = useState<number>(2.8);
  const [isDayTrade, setIsDayTrade] = useState<boolean>(true);

  const costs = useMemo(() => {
    const totalValue = price * shares;
    const rawFee = totalValue * 0.001425;
    const fee = Math.max(rawFee * (discount / 10), 20);
    const taxRate = isDayTrade ? 0.0015 : 0.003;
    const tax = Math.floor(totalValue * taxRate);
    const totalCost = Math.round((fee * 2) + tax);
    const breakEvenPrice = (totalValue + totalCost) / shares;
    const ticksNeeded = Math.ceil(((breakEvenPrice - price) / (price < 10 ? 0.01 : price < 50 ? 0.05 : price < 100 ? 0.1 : price < 500 ? 0.5 : 1)) * 10) / 10;

    return { totalValue, fee, tax, totalCost, breakEvenPrice, ticksNeeded };
  }, [price, shares, discount, isDayTrade]);

  return (
    <Card className="overflow-hidden border-border/50">
      <div className="bg-primary/5 p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <h2 className="font-bold">當沖獲利計算機</h2>
        </div>
      </div>
      <div className="p-5 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">進場價格</Label>
            <Input id="price" type="number" step="0.1" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shares">股數 (1張=1000股)</Label>
            <Input id="shares" type="number" step="100" value={shares} onChange={(e) => setShares(Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>手續費折扣: <span className="text-primary font-bold">{discount}折</span></Label>
            <span className="text-xs text-muted-foreground">常見為 2.8 ~ 6 折</span>
          </div>
          <Slider value={[discount]} min={1} max={10} step={0.1} onValueChange={(val) => setDiscount(val[0])} />
        </div>

        <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg">
          <Checkbox id="daytrade" checked={isDayTrade} onCheckedChange={(checked) => setIsDayTrade(!!checked)} />
          <Label htmlFor="daytrade" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1.5">
            啟用當沖交易成交稅減半 (0.15%)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><InfoIcon className="w-3 h-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent>目前台灣法規當沖交易稅為 0.15% (原 0.3%)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
        </div>

        <div className="pt-2 border-t border-border/40 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">成交總額</span>
            <span className="font-medium tabular-nums">{costs.totalValue.toLocaleString()} 元</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">單邊預估手續費 ({discount}折)</span>
            <span className="font-medium tabular-nums">{Math.round(costs.fee)} 元</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">預估交易稅 ({isDayTrade ? "0.15%" : "0.3%"})</span>
            <span className="font-medium tabular-nums">{costs.tax.toLocaleString()} 元</span>
          </div>
          <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg border border-primary/20">
            <span className="font-bold text-primary">總交易成本 (來回)</span>
            <span className="text-lg font-black text-primary tabular-nums">{costs.totalCost.toLocaleString()} 元</span>
          </div>
          <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">損平價位 (需高於此價才獲利)</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{costs.breakEvenPrice.toFixed(2)} 元</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3 h-3" />
              <span>進場後約向上跳動 <span className="font-bold text-emerald-600">{costs.ticksNeeded}</span> 個 Tick 即可損平</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
