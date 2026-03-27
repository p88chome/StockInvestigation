import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, AlertCircle, TrendingUp, ShieldCheck } from "lucide-react";

export function EducationSection() {
  return (
    <Card className="p-6 border-border/50">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">當沖交易指南 (附錄)</h2>
      </div>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="w-4 h-4" />
              1. 什麼是當沖？(Day Trading)
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-xs leading-relaxed text-muted-foreground space-y-2">
            <p>「當沖」是指在同一個交易日內完成買入並賣出的動作，平倉後不留持股過夜。其主要目的是利用股價盤中的波動賺取價差。</p>
            <p>優點是不需擔憂美股收盤或隔日開盤跳空的風險，且資金額度相對靈活（只需支付買賣差額加交易稅費，不需支付全部交割款）。</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="w-4 h-4" />
              2. 損平計算與 Tick
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-xs leading-relaxed text-muted-foreground space-y-2">
            <p>台股當沖成本包含：證交稅 0.15% (減半優惠) + 買賣兩邊手續費 0.1425% (視券商折扣而定)。</p>
            <p>一般而言，股價移動約 2~3 個跳動單位 (Tick) 即可損益兩平。計算機中的「損平 Tick」會根據股價自動判斷目前的跳動間距。</p>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            <div className="flex items-center gap-2 text-primary">
              <AlertCircle className="w-4 h-4" />
              3. 當沖三要訣
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-xs leading-relaxed text-muted-foreground space-y-2">
            <ul className="list-disc pl-4 space-y-1">
              <li>這不是長線投資：一旦盤勢不如預期，必須果斷執行停損，切勿「當沖變長抱」。</li>
              <li>量能是關鍵：選擇成交量大的標的才有足夠的摩擦力（流動性）讓你隨時進出。</li>
              <li>嚴禁凹單：當沖最大的風險在於市場反向波動時，若不及時出場，可能會造成巨大虧損。</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
